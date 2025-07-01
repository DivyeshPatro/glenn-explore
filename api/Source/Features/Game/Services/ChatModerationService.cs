using Api.Features.OpenRouter;
using Api.Source.Features.Game.Models;
using System.Text.Json;

namespace Api.Source.Features.Game.Services;

public class ChatModerationService
{
    private readonly OpenRouterClient _openRouterClient;
    private readonly ILogger<ChatModerationService> _logger;
    private const string MODEL = "google/gemini-2.0-flash-001";
    private const int TIMEOUT_SECONDS = 5;

    public ChatModerationService(OpenRouterClient openRouterClient, ILogger<ChatModerationService> logger)
    {
        _openRouterClient = openRouterClient;
        _logger = logger;
    }

    public async Task<ModerationResult> ModerateMessageAsync(string message)
    {
        try
        {
            _logger.LogInformation("Starting moderation for message: {Message}", message);
            
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(TIMEOUT_SECONDS));
            
            var request = new ChatCompletionRequest
            {
                Model = MODEL,
                Messages = new List<Api.Features.OpenRouter.Message>
                {
                    Api.Features.OpenRouter.Message.FromSystem(CreateModerationPrompt()),
                    Api.Features.OpenRouter.Message.FromUser($"Message to analyze: \"{message}\"")
                },
                Temperature = 0.1f,
                MaxTokens = 100,
                ResponseFormat = new ResponseFormat { Type = "json_object" }
            };

            _logger.LogInformation("Sending request to OpenRouter with model: {Model}", MODEL);
            var response = await _openRouterClient.CreateChatCompletionAsync(request, cts.Token);
            
            if (response?.Choices?.FirstOrDefault()?.Message?.Content != null)
            {
                var content = response.Choices.First().Message.Content.ToString();
                _logger.LogInformation("Received AI response: {Content}", content);
                var result = ParseModerationResponse(content);
                _logger.LogInformation("Parsed moderation result - IsAbusive: {IsAbusive}, Severity: {Severity}", 
                    result.IsAbusive, result.SeverityScore);
                return result;
            }
            
            _logger.LogWarning("Empty response from moderation AI");
            return ModerationResult.Timeout();
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Moderation request timed out after {Timeout}s for message: {Message}", 
                TIMEOUT_SECONDS, message);
            return ModerationResult.Timeout();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during message moderation for message: {Message}", message);
            return ModerationResult.Timeout();
        }
    }

    private string CreateModerationPrompt()
    {
        return @"You are a chat moderator for a family-friendly gaming platform. Analyze the given message and determine if it contains:

- Racist language or slurs
- Hate speech or harassment
- Profanity or vulgar language
- Threats or violent content
- Sexual content
- Spam or excessive repetition

Respond with JSON in this exact format:
{
  ""abusive"": true/false,
  ""severity"": 1-10,
}

Severity scale:
1-3: Mild (borderline inappropriate)
4-6: Moderate (clearly inappropriate)
7-10: Severe (extremely offensive, racist, threatening)

Be strict but fair. Gaming banter is okay, but racism and real toxicity should be flagged.";
    }

    private ModerationResult ParseModerationResponse(string content)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };
            
            var jsonDoc = JsonDocument.Parse(content);
            var root = jsonDoc.RootElement;
            
            var isAbusive = root.GetProperty("abusive").GetBoolean();
            var severity = root.GetProperty("severity").GetInt32();

            // Clamp severity to valid range
            severity = Math.Max(1, Math.Min(10, severity));

            return isAbusive 
                ? ModerationResult.Abusive(severity, "not specified")
                : ModerationResult.Clean(severity);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse moderation response: {Content}", content);
            return ModerationResult.Timeout();
        }
    }
} 