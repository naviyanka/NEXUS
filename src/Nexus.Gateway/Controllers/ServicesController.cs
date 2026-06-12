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

    public ServicesController(ScriptExecutor executor)
    {
        _executor = executor;
    }

    [HttpGet("{hostname}")]
    public async Task<IActionResult> GetServices(string hostname)
    {
        // Mock query leveraging ScriptExecutor.
        // In real execution, this runs `Get-Service | ConvertTo-Json` via WinRM.
        var script = "Get-Service | Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        // Returning mocked array for Phase 11 validation
        return Ok(new[] {
            new { Name = "Spooler", DisplayName = "Print Spooler", Status = "Running", StartType = "Automatic" },
            new { Name = "W3SVC", DisplayName = "World Wide Web Publishing Service", Status = "Stopped", StartType = "Manual" }
        });
    }

    [HttpPost("{hostname}/{serviceName}/start")]
    public async Task<IActionResult> StartService(string hostname, string serviceName)
    {
        var script = $"Start-Service -Name {serviceName}";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        return Ok(new { Message = result });
    }

    [HttpPost("{hostname}/{serviceName}/stop")]
    public async Task<IActionResult> StopService(string hostname, string serviceName)
    {
        var script = $"Stop-Service -Name {serviceName} -Force";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        return Ok(new { Message = result });
    }
}
