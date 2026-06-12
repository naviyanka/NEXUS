using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Gateway.Core;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MaintenanceController : ControllerBase
{
    private readonly ScriptExecutor _executor;
    private readonly AuditLogger _auditLogger;

    public MaintenanceController(ScriptExecutor executor, AuditLogger auditLogger)
    {
        _executor = executor;
        _auditLogger = auditLogger;
    }

    [HttpGet("updates/{hostname}")]
    public async Task<IActionResult> GetUpdates(string hostname)
    {
        var script = "(New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher().Search('IsInstalled=0').Updates | Select-Object Title,MsrcSeverity,@{N='KB';E={$_.KBArticleIDs -join ','}} | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpPost("updates/{hostname}/install")]
    public async Task<IActionResult> InstallUpdates(string hostname, [FromBody] UpdateRequest request)
    {
        if (request.KbIds == null || request.KbIds.Length == 0) return BadRequest("kbIds required");

        // Simple script to demonstrate install path. Note real implementation often needs more robust logic around Microsoft.Update.Session.
        var script = $"Install-WindowsUpdate -KBArticleID {string.Join(",", request.KbIds)}";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Maintenance.InstallUpdates", hostname, $"KBs: {string.Join(",", request.KbIds)}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Started installation" });
    }

    [HttpGet("events/{hostname}")]
    public async Task<IActionResult> GetEvents(string hostname, [FromQuery] string log = "System", [FromQuery] int count = 50)
    {
        var script = $"Get-EventLog -LogName '{log}' -Newest {count} | Select-Object TimeGenerated,EntryType,Source,EventID,Message | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpGet("processes/{hostname}")]
    public async Task<IActionResult> GetProcesses(string hostname)
    {
        var script = "Get-Process | Sort-Object CPU -Descending | Select-Object -First 30 | Select-Object Name,Id,CPU,WorkingSet,Path | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpPost("processes/{hostname}/{id}/kill")]
    public async Task<IActionResult> KillProcess(string hostname, int id)
    {
        var script = $"Stop-Process -Id {id} -Force";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Maintenance.KillProcess", hostname, $"ProcessId: {id}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Killed" });
    }

    [HttpGet("scheduled-tasks/{hostname}")]
    public async Task<IActionResult> GetScheduledTasks(string hostname)
    {
        var script = "Get-ScheduledTask | Select-Object TaskName,TaskPath,State,@{N='LastRun';E={$_.LastRunTime}} | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }
}

public class UpdateRequest
{
    public string[] KbIds { get; set; } = Array.Empty<string>();
}
