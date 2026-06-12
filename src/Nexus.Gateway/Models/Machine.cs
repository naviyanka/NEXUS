namespace Nexus.Gateway.Models;

public class Machine
{
    public int Id { get; set; }
    public string Hostname { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MachineGroupId { get; set; }
    public MachineGroup? MachineGroup { get; set; }
}
