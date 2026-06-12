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

    public MaintenanceController(ScriptExecutor executor)
    {
        _executor = executor;
    }

    [HttpGet("updates/{hostname}")]
    public async Task<IActionResult> GetUpdates(string hostname)
    {
        // Mock query leveraging ScriptExecutor.
        // In real execution, this runs Windows Update API queries.
        var script = "Get-WindowsUpdate";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        return Ok(new[] {
            new { Title = "Cumulative Update for Windows 11", KB = "KB5021234", Severity = "Critical" },
            new { Title = "Windows Malicious Software Removal Tool", KB = "KB890830", Severity = "Important" }
        });
    }

    [HttpPost("updates/{hostname}/install")]
    public async Task<IActionResult> InstallUpdates(string hostname, [FromBody] string kb)
    {
        var script = $"Install-WindowsUpdate -KBArticleID {kb}";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        return Ok(new { Message = result });
    }
}
