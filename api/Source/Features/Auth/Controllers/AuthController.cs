using Api.Features.Auth.Models;
using Api.Features.Auth.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Api.Core.Infrastructure.Database;
using System.Security.Cryptography;
using Api.Source.Features.Email.Models;
using Api.Source.Features.Email.Services;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Features.Auth.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly ILogger<AuthController> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly ApplicationDbContext _dbContext;
    public AuthController(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        ILogger<AuthController> logger,
        IServiceProvider serviceProvider,
        ApplicationDbContext dbContext)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
        _serviceProvider = serviceProvider;
        _dbContext = dbContext;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        try
        {
            var user = await _userManager.FindByNameAsync(request.Username);
            if (user == null || !user.IsActive)
            {
                return Unauthorized(new { message = "Invalid credentials" });
            }

            // Do not allow guest users to login with password
            if (user.IsGuest)
            {
                return BadRequest(new { message = "Guest users cannot login with password. Please use guest authentication." });
            }

            var result = await _signInManager.PasswordSignInAsync(
                user,
                request.Password,
                isPersistent: true,
                lockoutOnFailure: true);

            if (!result.Succeeded)
            {
                return Unauthorized(new { message = "Invalid credentials" });
            }

            user.UpdateLastLogin();
            await _userManager.UpdateAsync(user);

            var response = new LoginResponse(
                user.Id,
                user.UserName!,
                user.FirstName,
                user.LastName,
                user.Email,
                user.IsGuest,
                user.IsAdmin,
                null,
                null,
                user.HasPaid
            );
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("guest")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> GetOrCreateGuestUser([FromBody] CreateGuestRequest request)
    {
        try
        {
            // Check if user with this guest ID already exists
            var existingUser = await _userManager.FindByIdAsync(request.GuestId);

            // Get player data if exists
            var existingPlayer = await _dbContext.Players
                .FirstOrDefaultAsync(p => p.PlayerId == request.GuestId);

            if (existingUser != null)
            {
                if (!existingUser.IsGuest)
                {
                    return BadRequest(new { message = "This guest ID is no longer valid as it has been claimed" });
                }

                // Generate a guest key for old users who don't have one
                if (string.IsNullOrEmpty(existingUser.GuestKey))
                {
                    existingUser.GuestKey = GenerateGuestKey();
                    await _userManager.UpdateAsync(existingUser);
                    
                    // Sign in the existing guest user
                    await _signInManager.SignInAsync(existingUser, isPersistent: true);

                    // Return the newly generated key
                    return Ok(new LoginResponse(
                        existingUser.Id,
                        existingUser.UserName!,
                        existingUser.FirstName,
                        existingUser.LastName,
                        existingUser.Email,
                        existingUser.IsGuest,
                        existingUser.IsAdmin,
                        existingPlayer != null ? new LastPosition
                        {
                            X = existingPlayer.X,
                            Y = existingPlayer.Y,
                            Z = existingPlayer.Z,
                            RotationX = existingPlayer.RotationX,
                            RotationY = existingPlayer.RotationY,
                            RotationZ = existingPlayer.RotationZ
                        } : null,
                        existingUser.GuestKey  // Return the newly generated key
                    ));
                }

                // Existing key validation logic
                if (!string.IsNullOrEmpty(request.GuestKey))
                {
                    if (request.GuestKey != existingUser.GuestKey)
                    {
                        return Unauthorized(new { message = "Invalid guest key" });
                    }
                }
                else
                {
                    return Unauthorized(new { message = "Guest key required for this account" });
                }

                // Sign in the existing guest user
                await _signInManager.SignInAsync(existingUser, isPersistent: true);

                return Ok(new LoginResponse(
                    existingUser.Id,
                    existingUser.UserName!,
                    existingUser.FirstName,
                    existingUser.LastName,
                    existingUser.Email,
                    existingUser.IsGuest,
                    existingUser.IsAdmin,
                    existingPlayer != null ? new LastPosition
                    {
                        X = existingPlayer.X,
                        Y = existingPlayer.Y,
                        Z = existingPlayer.Z,
                        RotationX = existingPlayer.RotationX,
                        RotationY = existingPlayer.RotationY,
                        RotationZ = existingPlayer.RotationZ
                    } : null
                ));
            }

            // Generate a fun username
            var guestUsername = UsernameGenerator.GenerateUsername();
            var email = $"{guestUsername}@guest.com";
            // Try a few times if the username is taken
            for (int i = 0; i < 5; i++)
            {
                var usernameExists = await _userManager.FindByNameAsync(guestUsername);
                if (usernameExists == null) break;
                guestUsername = UsernameGenerator.GenerateUsername();
            }

            // Generate a secure guest key for new users
            var guestKey = GenerateGuestKey();

            // Create a new guest user
            var user = new User
            {
                Id = request.GuestId,
                UserName = guestUsername,
                IsGuest = true,
                IsActive = true,
                FirstName = guestUsername,
                GuestKey = guestKey,
                Email = email
            };

            var result = await _userManager.CreateAsync(user);
            if (!result.Succeeded)
            {
                _logger.LogError("Failed to create guest user: {ErrorMessage}", string.Join(", ", result.Errors.Select(e => e.Description)));
                return BadRequest(new { message = "Failed to create guest user" });
            }

            // Sign in the guest user
            await _signInManager.SignInAsync(user, isPersistent: true);

            // Return the guest key only on first creation
            return Ok(new LoginResponse(
                user.Id,
                existingPlayer != null ? existingPlayer.Name : user.UserName!,
                user.FirstName,
                user.LastName,
                user.Email,
                user.IsGuest,
                user.IsAdmin,
                existingPlayer != null ? new LastPosition
                {
                    X = existingPlayer.X,
                    Y = existingPlayer.Y,
                    Z = existingPlayer.Z,
                    RotationX = existingPlayer.RotationX,
                    RotationY = existingPlayer.RotationY,
                    RotationZ = existingPlayer.RotationZ
                } : null,
                guestKey  // Return the key only on first creation
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating guest user");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    private string GenerateGuestKey()
    {
        // Generate a cryptographically secure random key
        var keyBytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(keyBytes);
        }
        return Convert.ToBase64String(keyBytes);
    }

    [HttpPost("claim")]
    [Authorize]
    public async Task<ActionResult<LoginResponse>> ClaimGuestAccount([FromBody] ClaimAccountRequest request)
    {
        try
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null || !user.IsGuest)
            {
                return BadRequest(new { message = "Only guest accounts can be claimed" });
            }

            // Check if username is available
            var existingUser = await _userManager.FindByNameAsync(request.Username);
            if (existingUser != null)
            {
                return BadRequest(new { message = "Username is already taken" });
            }

            // Update user information
            user.UserName = request.Username;
            user.Email = request.Email; // Optional
            user.IsGuest = false;

            // Set password
            var addPasswordResult = await _userManager.AddPasswordAsync(user, request.Password);
            if (!addPasswordResult.Succeeded)
            {
                return BadRequest(new { message = "Failed to set password" });
            }

            // Update user
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest(new { message = "Failed to update user" });
            }

            // Sign in with new credentials
            await _signInManager.SignInAsync(user, isPersistent: true);

            return Ok(new LoginResponse(
                user.Id,
                user.UserName!,
                user.FirstName,
                user.LastName,
                user.Email,
                user.IsGuest,
                user.IsAdmin,
                null,
                null,
                user.HasPaid
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error claiming guest account");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        try
        {
            await _signInManager.SignOutAsync();
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserProfileResponse>> GetCurrentUser()
    {
        try
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized(new { message = "User not found" });
            }

            var response = new UserProfileResponse(
                user.Id,
                user.UserName!,
                user.FirstName,
                user.LastName,
                user.IsActive,
                user.IsGuest,
                user.IsAdmin,
                user.CreatedAt,
                user.LastLoginAt
            );
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting current user");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpPost("request-otp")]
    [AllowAnonymous]
    // [EnableRateLimiting("otp")]
    public async Task<ActionResult<RequestOtpResponse>> RequestOtp([FromBody] RequestOtpRequest request)
    {
        try
        {
            User? userToSendOtp = null;
            bool isExistingUser = false;
            request.Email = request.Email.ToLower();
            // If GuestId and GuestKey are provided, try to use that account
            var guestFound = false;
            if (!string.IsNullOrEmpty(request.GuestId) && !string.IsNullOrEmpty(request.GuestKey))
            {
                // Try to find the guest account
                var guestUser = await _userManager.Users
                    .FirstOrDefaultAsync(u => u.Id == request.GuestId && u.GuestKey == request.GuestKey && u.IsGuest);
                
                if (guestUser != null)
                {
                    // Update the guest account with the email
                    guestUser.Email = request.Email;
                    userToSendOtp = guestUser;
                    isExistingUser = true;
                    guestFound = true;
                    _logger.LogInformation("Updating guest account {GuestId} with email {Email}", guestUser.Id, request.Email);
                }
                else
                {
                    guestFound = false;
                }
            }
            if (!guestFound)
            {
                // No guest credentials provided, check if user exists with this email
                var existingUser = await _userManager.Users
                    .FirstOrDefaultAsync(u => u.Email == request.Email);
                
                if (existingUser != null)
                {
                    userToSendOtp = existingUser;
                    isExistingUser = true;
                }
                else
                {
                     var guestUsername = UsernameGenerator.GenerateUsername();

                    // Try a few times if the username is taken
                    for (int i = 0; i < 5; i++)
                    {
                        var usernameExists = await _userManager.FindByNameAsync(guestUsername);
                        if (usernameExists == null) break;
                        guestUsername = UsernameGenerator.GenerateUsername();
                    }
                    // No user with this email, create a new one
                    userToSendOtp = new User
                    {
                        Email = request.Email,
                        UserName = guestUsername,
                        IsActive = true,
                        IsGuest = false,
                        IsEmailVerified = false
                    };
                    
                    var createResult = await _userManager.CreateAsync(userToSendOtp);
                    if (!createResult.Succeeded)
                    {
                        return BadRequest(new { message = "Failed to create user account" });
                    }
                }
            }

            if(userToSendOtp == null) {
                return BadRequest(new { message = "Something went wrong, please try again later" });
            }
            
            // Generate a 6-digit OTP code
            var otpCode = GenerateOtpCode();
            
            // Set OTP expiration (10 minutes)
            userToSendOtp.SetOtp(otpCode, TimeSpan.FromMinutes(10));
            await _userManager.UpdateAsync(userToSendOtp);
            
            // Get the email service from the provider
            var emailService = _serviceProvider.GetRequiredService<ResendEmailService>();
            
            // Send email with OTP
            var emailResult = await emailService.SendEmailAsync(new EmailSendRequest
            {
                To = request.Email,
                Subject = "Your verification code",
                HtmlBody = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <h2>Your verification code</h2>
                        <p>Use the following code to verify your account:</p>
                        <div style='background-color: #f4f4f4; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold;'>
                            {otpCode}
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you didn't request this code, you can ignore this email.</p>
                    </div>
                ",
                PlainTextBody = $"Your verification code is: {otpCode}. This code will expire in 10 minutes."
            });
            
            if (!emailResult.Success)
            {
                _logger.LogError("Failed to send OTP email: {ErrorMessage}", emailResult.ErrorMessage);
                return StatusCode(500, new { message = "Failed to send verification email" });
            }
            
            return Ok(new RequestOtpResponse
            {
                Success = true,
                Message = "OTP sent successfully",
                IsExistingUser = isExistingUser,
                ExpiresAt = userToSendOtp.OtpExpiration?.ToString("o")
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error requesting OTP");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }
    
    [HttpPost("verify-otp")]
    [AllowAnonymous]
    //[EnableRateLimiting("otp")]
    public async Task<ActionResult<LoginResponse>> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        try
        {
            request.Email = request.Email.ToLower();
            // Find user by email
            var user = await _userManager.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid email or verification code" });
            }
            
            // Validate OTP
            if (!user.IsOtpValid(request.OtpCode))
            {
                return Unauthorized(new { message = "Invalid or expired verification code" });
            }
            
            // OTP is valid, mark email as verified and clear OTP
            user.MarkEmailAsVerified();
            user.ClearOtp();
            user.UpdateLastLogin(request.IsLowPerformanceDevice);
            
            // If this was a guest account, update it to be a regular account
            if (user.IsGuest)
            {
                user.IsGuest = false;
                _logger.LogInformation("Converted guest account {UserId} to regular account", user.Id);
            }
            
            await _userManager.UpdateAsync(user);
            
            // Sign in the user
            await _signInManager.SignInAsync(user, isPersistent: true);
            
            // Get player data if exists
            var existingPlayer = await _dbContext.Players
                .FirstOrDefaultAsync(p => p.PlayerId == user.Id);
            
            return Ok(new LoginResponse(
                user.Id,
                existingPlayer != null ? existingPlayer.Name : user.UserName!,
                user.FirstName,
                user.LastName,
                user.Email,
                user.IsGuest,
                user.IsAdmin,
                existingPlayer != null ? new LastPosition
                {
                    X = existingPlayer.X,
                    Y = existingPlayer.Y,
                    Z = existingPlayer.Z,
                    RotationX = existingPlayer.RotationX,
                    RotationY = existingPlayer.RotationY,
                    RotationZ = existingPlayer.RotationZ
                } : null,
                null,
                user.HasPaid
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying OTP");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }
    
    private string GenerateOtpCode()
    {
        // Generate a 6-digit OTP code
        var random = new Random();
        return random.Next(100000, 999999).ToString();
    }

    [HttpPost("resend-otp")]
    [AllowAnonymous]
    //[EnableRateLimiting("otp")]
    public async Task<ActionResult<RequestOtpResponse>> ResendOtp([FromBody] RequestOtpRequest request)
    {
        try
        {
            // Check if user exists with this email
            var user = await _userManager.Users
                .FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null)
            {
                return BadRequest(new { message = "No account found with this email" });
            }
            
            // Generate a new 6-digit OTP code
            var otpCode = GenerateOtpCode();
            
            // Set OTP expiration (10 minutes)
            user.SetOtp(otpCode, TimeSpan.FromMinutes(10));
            await _userManager.UpdateAsync(user);
            
            // Get the email service from the provider
            var emailService = _serviceProvider.GetRequiredService<ResendEmailService>();
            
            // Send email with OTP
            var emailResult = await emailService.SendEmailAsync(new EmailSendRequest
            {
                To = request.Email,
                Subject = "Your new verification code",
                HtmlBody = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <h2>Your new verification code</h2>
                        <p>You requested a new verification code. Use the following code:</p>
                        <div style='background-color: #f4f4f4; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold;'>
                            {otpCode}
                        </div>
                        <p>This code will expire in 10 minutes.</p>
                        <p>If you didn't request this code, you can ignore this email.</p>
                    </div>
                ",
                PlainTextBody = $"Your new verification code is: {otpCode}. This code will expire in 10 minutes."
            });
            
            if (!emailResult.Success)
            {
                _logger.LogError("Failed to send OTP email: {ErrorMessage}", emailResult.ErrorMessage);
                return StatusCode(500, new { message = "Failed to send verification email" });
            }
            
            return Ok(new RequestOtpResponse
            {
                Success = true,
                Message = "New verification code sent",
                IsExistingUser = true,
                ExpiresAt = user.OtpExpiration?.ToString()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resending OTP");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    [HttpGet("check")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> CheckAuth()
    {
        try
        {
            // Check if user is authenticated
            var user = await _userManager.GetUserAsync(User);
            
            if (user == null)
            {
                return Unauthorized(new { message = "Not authenticated" });
            }
            
            // Get player data if exists
            var existingPlayer = await _dbContext.Players
                .FirstOrDefaultAsync(p => p.PlayerId == user.Id);
            
            // User is authenticated, return user info
            return Ok(new LoginResponse(
                user.Id,
                existingPlayer != null ? existingPlayer.Name : user.UserName!,
                user.FirstName,
                user.LastName,
                user.Email,
                user.IsGuest,
                user.IsAdmin,
                existingPlayer != null ? new LastPosition
                {
                    X = existingPlayer.X,
                    Y = existingPlayer.Y,
                    Z = existingPlayer.Z,
                    RotationX = existingPlayer.RotationX,
                    RotationY = existingPlayer.RotationY,
                    RotationZ = existingPlayer.RotationZ
                } : null,
                null,
                user.HasPaid
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking authentication status");
            return StatusCode(500, new { message = "An error occurred while checking authentication status" });
        }
    }
}