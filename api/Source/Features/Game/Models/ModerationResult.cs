namespace Api.Source.Features.Game.Models;

public class ModerationResult
{
    public bool IsAbusive { get; set; }
    public int SeverityScore { get; set; } // 1-10 scale
    public string? Reason { get; set; }
    public bool TimedOut { get; set; } = false;
    
    public static ModerationResult Clean(int severityScore = 1)
    {
        return new ModerationResult
        {
            IsAbusive = false,
            SeverityScore = severityScore,
            Reason = "Content appears clean"
        };
    }
    
    public static ModerationResult Abusive(int severityScore, string? reason = null)
    {
        return new ModerationResult
        {
            IsAbusive = true,
            SeverityScore = severityScore,
            Reason = reason ?? "Content flagged as abusive"
        };
    }
    
    public static ModerationResult Timeout()
    {
        return new ModerationResult
        {
            IsAbusive = false,
            SeverityScore = 1,
            Reason = "Moderation timeout - message allowed",
            TimedOut = true
        };
    }
} 