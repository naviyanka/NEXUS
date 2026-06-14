using Nexus.Gateway.Data;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Core;

public class AuditLogger
{
    private readonly NexusDbContext _db;

    public AuditLogger(NexusDbContext db)
    {
        _db = db;
    }

    public async Task LogAsync(string username, string action, string hostname, string details, bool success)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            Username = username,
            Action = action,
            TargetHostname = hostname,
            Details = details,
            Success = success,
            Timestamp = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
    }
}
