using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Api.Features.Auth.Models;
using Api.Core.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Api.Source.Features.Game.Services;

namespace Api.Source.Features.Game;

[Authorize]
public class GameHub : Hub
{
    private readonly ILogger<GameHub> _logger;
    private readonly GameStateManager _gameState;
    private readonly UserManager<User> _userManager;
    private readonly MessagePersistenceService _messagePersistence;
    private readonly IServiceProvider _serviceProvider;
    private readonly NameValidationService _nameValidation;
    private readonly ChatModerationService _chatModeration;

    public GameHub(
        ILogger<GameHub> logger,
        GameStateManager gameState,
        UserManager<User> userManager,
        MessagePersistenceService messagePersistence,
        IServiceProvider serviceProvider,
        NameValidationService nameValidation,
        ChatModerationService chatModeration)
    {
        _logger = logger;
        _gameState = gameState;
        _userManager = userManager;
        _messagePersistence = messagePersistence;
        _serviceProvider = serviceProvider;
        _nameValidation = nameValidation;
        _chatModeration = chatModeration;
    }

    public override async Task OnConnectedAsync()
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user == null)
        {
            throw new HubException("User not found");
        }

        // Update user's last seen timestamp
        user.UpdateLastSeen();
        await _userManager.UpdateAsync(user);

        // Get existing player data for total time
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var existingPlayer = await dbContext.Players.FirstOrDefaultAsync(p => p.PlayerId == user.Id);
        var totalTime = existingPlayer?.TotalTimeOnline ?? TimeSpan.Zero;

        // Add to game state
        _gameState.AddPlayer(user.Id, new PlayerState
        {
            PlayerId = user.Id,
            Name = user.UserName ?? "Unknown",
            LastSeen = DateTime.UtcNow,
            TotalTimeOnline = totalTime,
            CurrentSessionStart = DateTime.UtcNow
        },
        user.IsAdmin, user.HasPaid);

        // Get recent messages
        var recentMessages = await _messagePersistence.GetRecentMessages();

        // Get quest progress
        var questProgress = await dbContext.QuestProgress
            .Where(qp => qp.PlayerId == user.Id)
            .ToDictionaryAsync(qp => qp.QuestId, qp => qp.Progress);

        // Send current state to the connecting client
        await Clients.Caller.SendAsync("InitialState", new
        {
            Players = _gameState.GetAllPlayers(),
            RecentMessages = recentMessages,
            QuestProgress = questProgress
        });

        // Notify others
        await Clients.Others.SendAsync("PlayerJoined", new
        {
            PlayerId = user.Id,
            Name = user.UserName,
            IsGuest = user.IsGuest
        });

        // Add total time message if player has played before
        if (totalTime > TimeSpan.Zero)
        {
            var hours = (int)Math.Floor(totalTime.TotalHours);
            var minutes = totalTime.Minutes;
            var timeMessage = hours > 0
                ? $"{hours} hours {minutes} minutes"
                : $"{minutes} minutes";

            _messagePersistence.QueueMessage(Message.SystemMessage($"Welcome back {user.UserName}! Total time played: {timeMessage}"));
            await BroadcastMessage(ToSystemMessage($"Welcome back {user.UserName}! Total time played: {timeMessage}"));
        }
        else
        {
            // Queue system messages
            var message = Message.SystemMessage($"Player {user.UserName} joined the game");
            _messagePersistence.QueueMessage(message);
            await BroadcastMessage(ToSystemMessage($"New player {user.UserName} joined the game"));
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user != null)
        {
            var timeOnline = 0;
            var player = _gameState.GetPlayer(user.Id);
            if (player != null && player.CurrentSessionStart.HasValue)
            {
                timeOnline = (int)(DateTime.UtcNow - player.CurrentSessionStart.Value).TotalSeconds;
            }
            // Remove player from game state
            _gameState.RemovePlayer(user.Id);

            // Update last seen
            user.UpdateLastSeen();
            await _userManager.UpdateAsync(user);

            // Format time online in a more readable way
            string timeOnlineMessage = "";
            if (timeOnline > 0)
            {
                TimeSpan time = TimeSpan.FromSeconds(timeOnline);
                if (time.TotalHours >= 1)
                {
                    timeOnlineMessage = $" ({(int)time.TotalHours}h {time.Minutes}m online)";
                }
                else if (time.TotalMinutes >= 1)
                {
                    timeOnlineMessage = $" ({time.Minutes}m {time.Seconds}s online)";
                }
                else
                {
                    timeOnlineMessage = $" ({time.Seconds}s online)";
                }
            }
            var message = $"Player {user.UserName} left the game{timeOnlineMessage}";
            // Queue system message
            _messagePersistence.QueueMessage(Message.SystemMessage(message));
            await BroadcastMessage(ToSystemMessage(message));
            // Notify others
            await Clients.Others.SendAsync("PlayerLeft", user.Id);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task UpdatePosition(PositionUpdate positionUpdate)
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user == null) return;
        _gameState.UpdatePlayerPosition(user.Id, positionUpdate);
    }
    public async Task SendChatMessage(string message)
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user == null) return;

        // Get player state for additional context
        var player = _gameState.GetPlayer(user.Id);

        // Create chat message
        var chatMessage = Message.FromGameHub(user.Id, player?.Name ?? "Unknown", message, player);

        // Moderate the message
        var moderationResult = await _chatModeration.ModerateMessageAsync(message);
        Console.WriteLine("Moderation result: " + moderationResult.IsAbusive);
        // Update message with moderation data
        chatMessage.IsFiltered = moderationResult.IsAbusive;
        chatMessage.AISeverityScore = moderationResult.SeverityScore;
        chatMessage.ModeratedAt = DateTime.UtcNow;

        // Always save message to database (for tracking)
        _messagePersistence.QueueMessage(chatMessage);

        // Only broadcast if not abusive
        if (!moderationResult.IsAbusive)
        {
            await BroadcastMessage(ToUserMessage(chatMessage));
        }
        else
        {
            _logger.LogWarning("Filtered abusive message from {PlayerId} ({PlayerName}): {Message} - Severity: {Severity}, Reason: {Reason}", 
                user.Id, player?.Name ?? "Unknown", message, moderationResult.SeverityScore, moderationResult.Reason);
        }
    }

    public async Task BroadcastMessage(ChatMessageEvent message)
    {
        await Clients.All.SendAsync("ChatMessage", message);
    }

    public ChatMessageEvent ToSystemMessage(string message)
    {
        return new ChatMessageEvent(
            PlayerId: "",
            Name: "",
            Message: message,
            IsSystem: true,
            IsGuest: false,
            Timestamp: DateTime.UtcNow
        );
    }

    public ChatMessageEvent ToUserMessage(Message message)
    {
        return new ChatMessageEvent(
            PlayerId: message.PlayerId ?? "",
            Name: message.PlayerName,
            Message: message.Content,
            IsSystem: false,
            IsGuest: false,
            Timestamp: message.SentAt
        );
    }

    public async Task<bool> ChangePlayerName(string newName)
    {
        try
        {
            // Validate name using the new service
            var validationResult = _nameValidation.ValidateName(newName);
            if (!validationResult.IsValid)
            {
                _logger.LogWarning("Name change rejected: {Reason}", validationResult.ErrorMessage);
                return false;
            }

            // Get current user and player
            var user = await _userManager.GetUserAsync(Context.User);
            if (user == null) return false;

            var player = _gameState.GetPlayer(Context.UserIdentifier!);
            if (player == null) return false;

            // Check for duplicate name
            if (_gameState.GetAllPlayers().Any(p => 
                p.PlayerId != player.PlayerId && // Don't check against self
                p.Name.Equals(newName, StringComparison.OrdinalIgnoreCase)))
                return false;

            var oldName = player.Name;

            // Update name in database
            user.UserName = newName;
            user.NormalizedUserName = newName.ToUpperInvariant();
            var result = await _userManager.UpdateAsync(user);
            
            if (!result.Succeeded)
            {
                _logger.LogError("Failed to update username in database: {Errors}", 
                    string.Join(", ", result.Errors.Select(e => e.Description)));
                return false;
            }
            
            // Update name in game state
            player.Name = newName;
            _gameState.MarkPlayerAsDirty(player.PlayerId);

            // Update name in Player table
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var dbPlayer = await dbContext.Players.FirstOrDefaultAsync(p => p.PlayerId == player.PlayerId);
            if (dbPlayer != null)
            {
                dbPlayer.Name = newName;
                await dbContext.SaveChangesAsync();
            }

            // Broadcast name change
            await Clients.All.SendAsync("PlayerNameChanged", new
            {
                PlayerId = player.PlayerId,
                OldName = oldName,
                NewName = newName,
                Timestamp = DateTime.UtcNow.ToString("O")
            });

            // Send system message about name change
            var message = Message.SystemMessage($"{oldName} changed their name to {newName}");
            await Clients.All.SendAsync("ChatMessage", new
            {
                PlayerId = "system",
                Name = "System",
                Message = message.Content,
                IsSystem = true,
                IsGuest = false,
                Timestamp = message.SentAt.ToString("O")
            });

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing player name");
            return false;
        }
    }

    public async Task<Dictionary<string, int>> GetQuestProgress()
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user == null) throw new HubException("User not found");

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var progress = await dbContext.QuestProgress
            .Where(qp => qp.PlayerId == user.Id)
            .ToDictionaryAsync(qp => qp.QuestId, qp => qp.Progress);

        return progress;
    }

    public async Task UpdateQuestProgress(string questId, int progress)
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user == null) throw new HubException("User not found");

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var questProgress = await dbContext.QuestProgress
            .FirstOrDefaultAsync(qp => qp.PlayerId == user.Id && qp.QuestId == questId);

        if (questProgress == null)
        {
            questProgress = QuestProgress.Create(user.Id, questId, progress);
            dbContext.QuestProgress.Add(questProgress);
        }
        else
        {
            questProgress.UpdateProgress(progress);
        }

        await dbContext.SaveChangesAsync();

        // Broadcast progress update
        var progressEvent = new QuestProgressEvent(
            user.Id,
            questId,
            progress,
            questProgress.UpdatedAt
        );

        await Clients.All.SendAsync("QuestProgress", progressEvent);

        // If quest is completed (progress == -1), send completion event
        if (progress == -1)
        {
            var completedEvent = new QuestCompletedEvent(
                user.Id,
                questId,
                "Quest Title", // TODO: Get actual quest title
                100, // TODO: Calculate actual XP gained
                questProgress.UpdatedAt
            );

            await Clients.All.SendAsync("QuestCompleted", completedEvent);
        }
    }

    public async Task<RaceResultResponse> AddRaceResult(string trackId, string trackName, double time)
    {
        var user = await _userManager.GetUserAsync(Context.User);
        if (user == null) throw new HubException("User not found");

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Create new result
        var result = RaceResult.Create(user.Id, user.UserName ?? "Unknown", trackId, time);

        // Check for personal best
        var previousPersonalBest = await dbContext.RaceResults
            .Where(r => r.PlayerId == user.Id && r.TrackId == trackId)
            .OrderBy(r => r.Time)
            .Select(r => r.Time)
            .FirstOrDefaultAsync();

        var isPersonalBest = previousPersonalBest == 0 || time < previousPersonalBest;

        // Check for track record
        var previousTrackRecord = await dbContext.RaceResults
            .Where(r => r.TrackId == trackId)
            .OrderBy(r => r.Time)
            .Select(r => r.Time)
            .FirstOrDefaultAsync();

        var isTrackRecord = previousTrackRecord == 0 || time < previousTrackRecord;

        // Save result
        dbContext.RaceResults.Add(result);
        await dbContext.SaveChangesAsync();

        // Create event
        var raceEvent = new RaceResultEvent(
            user.Id,
            user.UserName ?? "Unknown",
            trackId,
            trackName,
            time,
            isPersonalBest,
            isTrackRecord,
            result.CompletedAt
        );

        // Format time nicely
        var timeStr = TimeSpan.FromSeconds(time).ToString(@"m\:ss\.fff");
        
        // Create message based on achievements
        string message;
        if (isTrackRecord)
        {
            message = $"🏆 NEW TRACK RECORD! {user.UserName} completed {trackName} in {timeStr}!";
        }
        else if (isPersonalBest)
        {
            message = $"⭐ NEW PERSONAL BEST! {user.UserName} completed {trackName} in {timeStr}!";
        }
        else
        {
            message = $"{user.UserName} completed {trackName} in {timeStr}";
        }

        // Queue system message
        _messagePersistence.QueueMessage(Message.SystemMessage(message));
        await BroadcastMessage(ToSystemMessage(message));

        // Broadcast race result
        await Clients.All.SendAsync("RaceResult", raceEvent);

        return new RaceResultResponse(
            isPersonalBest,
            isTrackRecord,
            previousPersonalBest == 0 ? null : previousPersonalBest,
            previousTrackRecord == 0 ? null : previousTrackRecord
        );
    }
}