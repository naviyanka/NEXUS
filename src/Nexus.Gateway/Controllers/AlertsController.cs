using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Data;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AlertsController : ControllerBase
{
    private readonly NexusDbContext _context;

    public AlertsController(NexusDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetActiveAlerts()
    {
        var alerts = await _context.Alerts
            .Where(a => !a.IsAcknowledged)
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync();
        return Ok(alerts);
    }

    [HttpGet("all")]
    public async Task<IActionResult> GetAllAlerts([FromQuery] int page = 1, [FromQuery] int size = 50)
    {
        var alerts = await _context.Alerts
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync();
        return Ok(alerts);
    }

    [HttpPost("{id}/acknowledge")]
    public async Task<IActionResult> AcknowledgeAlert(int id)
    {
        var alert = await _context.Alerts.FindAsync(id);
        if (alert == null) return NotFound();

        alert.IsAcknowledged = true;
        alert.AcknowledgedAt = DateTime.UtcNow;
        alert.AcknowledgedBy = User.Identity?.Name ?? "Unknown";

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Acknowledged" });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAlert(int id)
    {
        var alert = await _context.Alerts.FindAsync(id);
        if (alert == null) return NotFound();

        _context.Alerts.Remove(alert);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
