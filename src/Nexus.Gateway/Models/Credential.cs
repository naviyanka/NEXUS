namespace Nexus.Gateway.Models;

public class Credential
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;          // friendly name e.g. "Domain Admin"
    public string Username { get; set; } = string.Empty;
    public string EncryptedPassword { get; set; } = string.Empty; // DPAPI encrypted
    public string Domain { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
