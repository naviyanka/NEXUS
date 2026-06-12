using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Data;

public class NexusDbContext : DbContext
{
    public NexusDbContext(DbContextOptions<NexusDbContext> options) : base(options) { }

    public DbSet<Machine> Machines { get; set; } = null!;
    public DbSet<MachineGroup> MachineGroups { get; set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; set; } = null!;
    public DbSet<SavedScript> SavedScripts { get; set; } = null!;
    public DbSet<Credential> Credentials { get; set; } = null!;
    public DbSet<Alert> Alerts { get; set; } = null!;
    public DbSet<JobHistory> JobHistories { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Machine>()
            .HasOne(m => m.MachineGroup)
            .WithMany(g => g.Machines)
            .HasForeignKey(m => m.MachineGroupId)
            .OnDelete(DeleteBehavior.SetNull);

        // Define other relationships/constraints here if needed
        modelBuilder.Entity<Machine>()
            .HasIndex(m => m.Hostname)
            .IsUnique();
    }
}
