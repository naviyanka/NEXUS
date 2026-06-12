using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Gateway.Core;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ServicesController : ControllerBase
{
    private readonly ScriptExecutor _executor;
    private readonly AuditLogger _auditLogger;

    public ServicesController(ScriptExecutor executor, AuditLogger auditLogger)
    {
        _executor = executor;
        _auditLogger = auditLogger;
    }

    [HttpGet("{hostname}")]
    public async Task<IActionResult> GetServices(string hostname)
    {
        var script = "Get-Service | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Depth 2";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });

        var services = JsonSerializer.Deserialize<object>(result.Output);
        return Ok(services);
    }

    [HttpGet("{hostname}/{serviceName}")]
    public async Task<IActionResult> GetService(string hostname, string serviceName)
    {
        var script = $"Get-Service -Name '{serviceName}' | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Depth 2";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });

        var service = JsonSerializer.Deserialize<object>(result.Output);
        return Ok(service);
    }

    [HttpPost("{hostname}/{serviceName}/start")]
    public async Task<IActionResult> StartService(string hostname, string serviceName)
    {
        var script = $"Start-Service -Name '{serviceName}'";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Service.Start", hostname, $"Started service: {serviceName}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Success" });
    }

    [HttpPost("{hostname}/{serviceName}/stop")]
    public async Task<IActionResult> StopService(string hostname, string serviceName)
    {
        var script = $"Stop-Service -Name '{serviceName}' -Force";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Service.Stop", hostname, $"Stopped service: {serviceName}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Success" });
    }

    [HttpPost("{hostname}/{serviceName}/restart")]
    public async Task<IActionResult> RestartService(string hostname, string serviceName)
    {
        var script = $"Restart-Service -Name '{serviceName}' -Force";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Service.Restart", hostname, $"Restarted service: {serviceName}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Success" });
    }
}
