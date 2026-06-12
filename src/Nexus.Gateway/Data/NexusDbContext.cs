using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Data;

public class NexusDbContext : DbContext
{
    public NexusDbContext(DbContextOptions<NexusDbContext> options) : base(options) { }

    public DbSet<Machine> Machines { get; set; }
    public DbSet<MachineGroup> MachineGroups { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}
