using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Core;
using Nexus.Gateway.Data;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MachineController : ControllerBase
{
    private readonly NexusDbContext _context;
    private readonly ScriptExecutor _executor;
    private readonly AuditLogger _auditLogger;

    public MachineController(NexusDbContext context, ScriptExecutor executor, AuditLogger auditLogger)
    {
        _context = context;
        _executor = executor;
        _auditLogger = auditLogger;
    }

    [HttpGet]
    public async Task<IActionResult> GetMachines()
    {
        var machines = await _context.Machines.Include(m => m.MachineGroup).ToListAsync();
        return Ok(machines);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetMachine(int id)
    {
        var machine = await _context.Machines.Include(m => m.MachineGroup).FirstOrDefaultAsync(m => m.Id == id);
        if (machine == null) return NotFound();
        return Ok(machine);
    }

    [HttpPost]
    public async Task<IActionResult> CreateMachine([FromBody] Machine machine)
    {
        _context.Machines.Add(machine);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetMachine), new { id = machine.Id }, machine);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateMachine(int id, [FromBody] Machine machine)
    {
        if (id != machine.Id) return BadRequest();
        _context.Entry(machine).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMachine(int id)
    {
        var machine = await _context.Machines.FindAsync(id);
        if (machine == null) return NotFound();

        _context.Machines.Remove(machine);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/ping")]
    public async Task<IActionResult> PingMachine(int id)
    {
        var machine = await _context.Machines.FindAsync(id);
        if (machine == null) return NotFound();

        var script = $"Test-Connection -ComputerName {machine.Hostname} -Count 1 -Quiet";
        var result = await _executor.ExecutePowerShellAsync(script, "localhost"); // Run from gateway

        bool isOnline = result.Success && result.Output.Trim().Equals("True", StringComparison.OrdinalIgnoreCase);

        machine.LastSeenOnline = isOnline ? DateTime.UtcNow : machine.LastSeenOnline;
        machine.LastKnownStatus = isOnline ? "Online" : "Offline";
        await _context.SaveChangesAsync();

        return Ok(new { isOnline, hostname = machine.Hostname });
    }

    [HttpGet("status-all")]
    public async Task<IActionResult> StatusAll()
    {
        var machines = await _context.Machines.ToListAsync();

        var tasks = machines.Select(async m =>
        {
            var script = $"Test-Connection -ComputerName {m.Hostname} -Count 1 -Quiet";
            var result = await _executor.ExecutePowerShellAsync(script, "localhost");
            bool isOnline = result.Success && result.Output.Trim().Equals("True", StringComparison.OrdinalIgnoreCase);

            if (isOnline) m.LastSeenOnline = DateTime.UtcNow;
            m.LastKnownStatus = isOnline ? "Online" : "Offline";

            return new { id = m.Id, hostname = m.Hostname, isOnline, lastSeen = m.LastSeenOnline };
        });

        var statuses = await Task.WhenAll(tasks);
        await _context.SaveChangesAsync();

        return Ok(statuses);
    }

    [HttpGet("{id}/overview")]
    public async Task<IActionResult> GetOverview(int id)
    {
        var machine = await _context.Machines.FindAsync(id);
        if (machine == null) return NotFound();

        var scripts = new[]
        {
            "Get-ComputerInfo | Select WindowsProductName,TotalPhysicalMemory,OsArchitecture | ConvertTo-Json",
            "Get-CimInstance Win32_Processor | Select Name,NumberOfCores,LoadPercentage | ConvertTo-Json",
            "Get-PSDrive C | Select Used,Free | ConvertTo-Json",
            "((Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalHours | ConvertTo-Json"
        };

        var tasks = scripts.Select(s => _executor.ExecutePowerShellAsync(s, machine.Hostname));
        var results = await Task.WhenAll(tasks);

        var overview = new
        {
            ComputerInfo = results[0].Success ? JsonSerializer.Deserialize<object>(results[0].Output) : new { Error = results[0].Error },
            ProcessorInfo = results[1].Success ? JsonSerializer.Deserialize<object>(results[1].Output) : new { Error = results[1].Error },
            DriveInfo = results[2].Success ? JsonSerializer.Deserialize<object>(results[2].Output) : new { Error = results[2].Error },
            UptimeHours = results[3].Success ? JsonSerializer.Deserialize<object>(results[3].Output) : new { Error = results[3].Error }
        };

        return Ok(overview);
    }
}
