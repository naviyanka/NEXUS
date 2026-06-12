namespace Nexus.Gateway.Models;

public class Machine
{
    public int Id { get; set; }
    public string Hostname { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;           // comma-separated: "dc,dns,dhcp"
    public string Role { get; set; } = string.Empty;           // "WFE" | "APP" | "DC" | "SQL" etc.
    public string Icon { get; set; } = "server";
    public int? MachineGroupId { get; set; }
    public MachineGroup? MachineGroup { get; set; }
    public int? CredentialId { get; set; }
    public DateTime? LastSeenOnline { get; set; }
    public string LastKnownStatus { get; set; } = "Unknown";
}
