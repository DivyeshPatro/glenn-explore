using Api.Features.Auth.Models;
using Api.Features.Auth.Services;
using Api.Core.Infrastructure.Database;
using Api.Features.UserManagement.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Api.Source.Features.Game;
using Api.Source.Features.Toplist.Services;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Api.Features.OpenRouter.Services;
using Api.Source.Features.Email.Models;
using Api.Source.Features.Email.Services;
using Resend;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.AspNetCore.DataProtection;
using Api.Features.Auth.Payment;
using Api.Source.Features.Models.Services;
using Api.Source.Features.Files.Services;
using Microsoft.Extensions.FileProviders;
using Api.Source.Features.Dashboard.Services;
using Api.Source.Features.Marketing.Services;

namespace Api.Shell;

public partial class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Add services to the container.
        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        // Configure URLs
        builder.WebHost.UseUrls("http://0.0.0.0:5001");
        
        // Configure rate limiting for OTP endpoints
        builder.Services.AddRateLimiter(options =>
        {
            // Rate limit OTP requests to 3 per minute per IP address
            options.AddFixedWindowLimiter("otp", options =>
            {
                options.PermitLimit = 20;
                options.Window = TimeSpan.FromMinutes(1);
                options.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                options.QueueLimit = 0;
                options.AutoReplenishment = true; // Ensure auto replenishment is enabled
            });
            
            // Configure response for rate limited requests
            options.OnRejected = async (context, token) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.HttpContext.Response.ContentType = "application/json";
                
                // Calculate when the user can retry
                var retryAfter = 60; // Default 60 seconds if we can't determine
                
                await context.HttpContext.Response.WriteAsJsonAsync(new { 
                    message = $"Too many verification code requests. Please try again in {retryAfter} seconds.",
                    retryAfter = retryAfter
                }, token);
            };
            
            // Add global rules for specific endpoints
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                // Apply rate limiting to specific Auth endpoints
                if (context.Request.Path.StartsWithSegments("/api/Auth/request-otp") ||
                    context.Request.Path.StartsWithSegments("/api/Auth/verify-otp") ||
                    context.Request.Path.StartsWithSegments("/api/Auth/resend-otp"))
                {
                    return RateLimitPartition.GetFixedWindowLimiter(
                        context.Connection.RemoteIpAddress?.ToString() ?? "anon",
                        factory => new FixedWindowRateLimiterOptions
                        {
                            AutoReplenishment = true,
                            PermitLimit = 20,
                            Window = TimeSpan.FromMinutes(1)
                        });
                }
                
                // Allow unlimited for other endpoints
                return RateLimitPartition.GetNoLimiter("unlimited");
            });
        });
        
        var openRouterApiKey = Environment.GetEnvironmentVariable("OPENROUTER_API_KEY");
        if (string.IsNullOrEmpty(openRouterApiKey))
        {
            throw new InvalidOperationException("OPENROUTER_API_KEY environment variable is not set");
        }
        builder.Configuration["OpenRouter:ApiKey"] = openRouterApiKey;

        // Configure Resend email service
        var resendApiKey = Environment.GetEnvironmentVariable("RESEND_KEY");
        if (string.IsNullOrEmpty(resendApiKey))
        {
            throw new InvalidOperationException("RESEND_KEY environment variable is not set");
        }
        
        // Configure Resend client options
        builder.Services.AddOptions();
        builder.Services.AddHttpClient<ResendClient>();
        builder.Services.Configure<ResendClientOptions>(options => options.ApiToken = resendApiKey);
        builder.Services.AddTransient<IResend, ResendClient>();
        builder.Services.AddScoped<ResendEmailService>();

        // Add memory cache
        builder.Services.AddMemoryCache();

        // Add SignalR
        builder.Services.AddSignalR(options =>
        {
            options.EnableDetailedErrors = true; // Enable for all environments
            options.MaximumReceiveMessageSize = 102400; // 100KB limit
            options.HandshakeTimeout = TimeSpan.FromSeconds(15);
            options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
            options.KeepAliveInterval = TimeSpan.FromSeconds(15);
        })
        .AddJsonProtocol(options => {
            options.PayloadSerializerOptions.PropertyNameCaseInsensitive = true;
            options.PayloadSerializerOptions.WriteIndented = true;
        });

        // Add logging configuration
        builder.Logging.AddFilter("Microsoft.AspNetCore.SignalR", LogLevel.Debug);
        builder.Logging.AddFilter("Microsoft.AspNetCore.Http.Connections", LogLevel.Debug);

        // Add game services
        builder.Services.Configure<GameOptions>(
            builder.Configuration.GetSection(GameOptions.SectionName)
        );
        builder.Services.AddSingleton<GameStateManager>();
        builder.Services.AddHostedService<GameStateBackgroundService>();
        builder.Services.AddSingleton<MessagePersistenceService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<MessagePersistenceService>());
        builder.Services.AddHostedService<GamePersistenceService>();
        builder.Services.AddSingleton<NameValidationService>();

        // Add LLM persistence service
        builder.Services.AddSingleton<LLMMessagePersistenceService>();
        builder.Services.AddHostedService(sp => sp.GetRequiredService<LLMMessagePersistenceService>());

        // Register OpenRouter client and moderation service
        builder.Services.AddScoped<Api.Features.OpenRouter.OpenRouterClient>(provider =>
        {
            var configuration = provider.GetRequiredService<IConfiguration>();
            var apiKey = configuration["OpenRouter:ApiKey"];
            var siteUrl = configuration["OpenRouter:SiteUrl"];
            var siteName = configuration["OpenRouter:SiteName"];
            return new Api.Features.OpenRouter.OpenRouterClient(apiKey, siteUrl, siteName);
        });
        builder.Services.AddScoped<Api.Source.Features.Game.Services.ChatModerationService>();

        // Register application services
        builder.Services.AddScoped<UserManagementService>();
        builder.Services.AddScoped<ToplistService>();

        // Register Onomondo service
        builder.Services.AddHttpClient();

        // Configure CORS for SignalR
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("SignalRPolicy", builder =>
            {
                builder
                    .WithOrigins(
                        "https://api.playglenn.com",
                        "http://localhost:5173",
                        "https://playglenn.com",
                        "https://www.playglenn.com",
                        "https://glenn-explore.vercel.app",
                        "https://glenn-explore-dj4ixicpi-williamavholmbergs-projects.vercel.app",
                        "https://glenn-explore-williamavholmberg-williamavholmbergs-projects.vercel.app"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        // Configure Swagger
        builder.Services.AddSwaggerGen(c =>
        {
            c.SwaggerDoc("v1", new OpenApiInfo { Title = "api", Version = "v1" });

            // Add JWT Authentication
            c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
                Name = "Authorization",
                In = ParameterLocation.Header,
                Type = SecuritySchemeType.ApiKey,
                Scheme = "Bearer"
            });

            c.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference
                        {
                            Type = ReferenceType.SecurityScheme,
                            Id = "Bearer"
                        }
                    },
                    Array.Empty<string>()
                }
            });
        });

        // Add SQLite
        var dbPath = builder.Environment.IsProduction()
            ? Path.Combine(Environment.GetEnvironmentVariable("DEPLOY_PATH") ?? "", "data/app.db")
            : "data/app.db";

        // Get data directory path
        var dataPath = builder.Environment.IsProduction()
            ? Path.Combine(Environment.GetEnvironmentVariable("DEPLOY_PATH") ?? "", "data")
            : "data";

        // Ensure data directory and uploads directories exist
        Directory.CreateDirectory(dataPath);
        Directory.CreateDirectory(Path.Combine(dataPath, "uploads"));
        Directory.CreateDirectory(Path.Combine(dataPath, "uploads", "models"));

        builder.Services.AddHealthChecks();

        // Configure Data Protection to persist keys in data directory
        builder.Services.AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(dataPath))
            .SetApplicationName("RealGame");

        // Database
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseSqlite($"Data Source={dbPath}");
            // Only show EF warnings and errors
            options.UseLoggerFactory(LoggerFactory.Create(builder =>
                builder
                    .AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning)
                    .AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning)
            ));
        });

        // Identity
        builder.Services.AddIdentity<User, IdentityRole>(options =>
        {
            // Password settings - More lenient for game users
            options.Password.RequireDigit = false;
            options.Password.RequiredLength = 6;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;

            // Lockout settings
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.MaxFailedAccessAttempts = 5;

            // User settings
            options.User.RequireUniqueEmail = true;  // Make email optional
            options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+"; // Allow these in usernames
            options.SignIn.RequireConfirmedEmail = false;  // No email confirmation needed
        })
        .AddEntityFrameworkStores<ApplicationDbContext>()
        .AddDefaultTokenProviders();

        // Authentication setup
        builder.Services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = IdentityConstants.ApplicationScheme;
            options.DefaultChallengeScheme = IdentityConstants.ApplicationScheme;
            options.DefaultSignInScheme = IdentityConstants.ApplicationScheme;
        });

        // Add custom authorization options to ensure proper 401 responses
        builder.Services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();

            // Explicitly allow anonymous access to certain endpoints
            options.AddPolicy("AllowAnonymous", policy => { policy.RequireAssertion(_ => true); });

            // Don't continue evaluation on failure
            options.InvokeHandlersAfterFailure = false;
        });

        // Cookie settings
        builder.Services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.HttpOnly = true;
            options.Cookie.Domain = null;
            options.Cookie.SameSite = SameSiteMode.None;
            options.Cookie.SecurePolicy = CookieSecurePolicy.Always;  // Set to Always instead of SameAsRequest
            options.ExpireTimeSpan = TimeSpan.FromDays(90);
            options.SlidingExpiration = true;

            // Configure to return 401 instead of redirecting to login
            options.Events.OnRedirectToLogin = context =>
            {
                var logger = context.HttpContext.RequestServices
                    .GetRequiredService<ILogger<Program>>();

                logger.LogWarning(
                    "Unauthorized access attempt at {Path}",
                    context.Request.Path
                );

                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };

            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
        });

        // Add OpenTelemetry
        builder.Services.AddOpenTelemetry().WithTracing(builder =>
        {
            builder
                // Configure ASP.NET Core Instrumentation
                .AddAspNetCoreInstrumentation(opts => {
                    opts.EnableAspNetCoreSignalRSupport = true;
                })
                // Configure OpenTelemetry Protocol (OTLP) Exporter
                .AddOtlpExporter();
        });

        // Configure Stripe
        var stripeSecretKey = Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY");
        var stripeWebhookSecret = Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET");
        if (string.IsNullOrEmpty(stripeSecretKey))
        {
            throw new InvalidOperationException("STRIPE_SECRET_KEY environment variable is not set");
        }
        if (string.IsNullOrEmpty(stripeWebhookSecret))
        {
            throw new InvalidOperationException("STRIPE_WEBHOOK_SECRET environment variable is not set");
        }
        builder.Configuration["Stripe:SecretKey"] = stripeSecretKey;
        builder.Configuration["Stripe:WebhookSecret"] = stripeWebhookSecret;

        // Configure domain
        var domain = builder.Environment.IsDevelopment() 
            ? "http://localhost:5173" 
            : "https://playglenn.com";
        builder.Configuration["App:Domain"] = domain;

        // Add Stripe services
        builder.Services.AddScoped<PaymentService>();

        // Add model services
        builder.Services.AddScoped<ModelsService>();

        // Add file services
        builder.Services.AddScoped<FileService>();

        // Add dashboard services
        builder.Services.AddScoped<DashboardService>();

        // Add marketing services
        builder.Services.AddScoped<MarketingService>();

        var app = builder.Build();

        // Apply migrations or ensure database is created based on environment
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            
            try
            {
                Console.WriteLine("Checking if database exists...");
                Console.WriteLine("Applying migrations...");
                db.Database.Migrate();
                Console.WriteLine("Migrations applied successfully");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to initialize database. Error: {Message}", ex.Message);
                logger.LogError("Stack trace: {StackTrace}", ex.StackTrace);
                throw; // Re-throw to prevent app from starting with invalid database
            }
        }

        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger(c =>
            {
                c.RouteTemplate = "api/swagger/{documentName}/swagger.json";
            });

            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/api/swagger/v1/swagger.json", "api");
                c.RoutePrefix = "swagger";
            });
        }
        else
        {
            app.UseHsts();
        }

        // Add CORS before routing
        app.UseCors("SignalRPolicy");

        // Add rate limiting middleware
        app.UseRateLimiter();

        app.UseHttpsRedirection();
        app.UseRouting();

        app.UseAuthentication();
        app.UseAuthorization();

        // Add middleware to serve static files from wwwroot
        app.UseStaticFiles();

        // Configure static file serving for uploads directory
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(
                Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "uploads"))
            ),
            RequestPath = "/uploads",
            ServeUnknownFileTypes = true,
            DefaultContentType = "application/octet-stream",
            ContentTypeProvider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider
            {
                Mappings = 
                {
                    [".glb"] = "model/gltf-binary"
                }
            }
        });

        // Map SignalR hub
        app.MapHub<GameHub>("/api/hubs/game");
        app.MapHealthChecks("/api/health").AllowAnonymous();

        // Configure auth-related endpoints to allow anonymous access
        app.MapControllers()
           .RequireAuthorization()  // Default: require auth
           .WithMetadata(new Microsoft.AspNetCore.Authorization.AllowAnonymousAttribute());  // Override for specific endpoints via attribute

        app.Run();
    }
}
