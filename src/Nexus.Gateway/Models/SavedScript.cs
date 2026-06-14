namespace Nexus.Gateway.Models;

public class SavedScript
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string ScriptType { get; set; } = "powershell";
    public string Category { get; set; } = string.Empty;     // "System", "SharePoint", "Network", etc.
    public string Tags { get; set; } = string.Empty;          // comma-separated
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string Author { get; set; } = string.Empty;
    public bool IsBuiltIn { get; set; }                       // seeded scripts = true
}
