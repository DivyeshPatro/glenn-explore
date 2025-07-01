using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Api.Source.Features.Game;

public enum MessageType
{
    Chat,
    System
}

[Table("Messages")]
public class Message
{
    [Key]
    public Guid Id { get; set; }
    
    public MessageType Type { get; set; }
    
    public string? PlayerId { get; set; }
    
    public string? PlayerName { get; set; }
    
    public string Content { get; set; } = null!;
    
    public DateTime SentAt { get; set; }
    
    // New moderation properties
    public bool IsFiltered { get; set; } = false;
    
    public int? AISeverityScore { get; set; } // 1-10 scale
    
    public DateTime? ModeratedAt { get; set; }
    
    public static Message FromGameHub(string playerId, string playerName, string content, PlayerState? playerState)
    {
        return new Message
        {
            Id = Guid.NewGuid(),
            Type = MessageType.Chat,
            PlayerId = playerId,
            PlayerName = playerName,
            Content = content,
            SentAt = DateTime.UtcNow
        };
    }
    
    public static Message SystemMessage(string content)
    {
        return new Message
        {
            Id = Guid.NewGuid(),
            Type = MessageType.System,
            Content = content,
            SentAt = DateTime.UtcNow
        };
    }
} 