using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Gateway.Core;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SharePointController : ControllerBase
{
    private readonly ScriptExecutor _executor;

    public SharePointController(ScriptExecutor executor)
    {
        _executor = executor;
    }

    [HttpGet("topology/{hostname}")]
    public async Task<IActionResult> GetTopology(string hostname)
    {
        // Mock query leveraging ScriptExecutor.
        // In real execution, this runs SharePoint Cmdlets (e.g. Get-SPServer) via WinRM.
        var script = "Get-SPServer | Select-Object Name, Role, Status | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        return Ok(new[] {
            new { Name = "SP2019-WFE01", Role = "WebFrontEnd", Status = "Online" },
            new { Name = "SP2019-APP01", Role = "Application", Status = "Online" }
        });
    }

    [HttpGet("configdiff")]
    public async Task<IActionResult> GetConfigDiff([FromQuery] string wfeHost, [FromQuery] string appHost)
    {
        // Mock configuration drift logic between two machines
        return Ok(new[] {
            new { Component = "web.config", wfeHost = "Valid", appHost = "MissingBinding", Status = "Mismatch" },
            new { Component = "Distributed Cache", wfeHost = "Up", appHost = "Up", Status = "Match" }
        });
    }
}
