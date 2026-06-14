namespace Nexus.Gateway.Models;

public class Alert
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Severity { get; set; } = "Info";            // Critical | Warning | Info
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string SourceHostname { get; set; } = string.Empty;
    public string SourcePlugin { get; set; } = string.Empty;
    public bool IsAcknowledged { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
}
