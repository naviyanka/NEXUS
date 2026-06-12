namespace Nexus.Gateway.Models;

public class MachineGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ICollection<Machine> Machines { get; set; } = new List<Machine>();
}
