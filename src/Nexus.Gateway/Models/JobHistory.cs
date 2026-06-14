namespace Nexus.Gateway.Models;

public class JobHistory
{
    public int Id { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string JobName { get; set; } = string.Empty;
    public string TargetHostnames { get; set; } = string.Empty; // JSON array
    public string ScriptContent { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";            // Pending | Running | Success | Failed
    public string Output { get; set; } = string.Empty;
    public string InitiatedBy { get; set; } = string.Empty;
}
