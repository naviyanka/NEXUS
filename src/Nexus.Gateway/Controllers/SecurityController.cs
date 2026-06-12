using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Gateway.Core;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SecurityController : ControllerBase
{
    private readonly ScriptExecutor _executor;

    public SecurityController(ScriptExecutor executor)
    {
        _executor = executor;
    }

    [HttpGet("firewall/{hostname}")]
    public async Task<IActionResult> GetFirewallRules(string hostname)
    {
        var script = "Get-NetFirewallRule | Select-Object Name, DisplayName, Enabled, Action | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        return Ok(new[] {
            new { Name = "CoreNet-Ping-In", DisplayName = "Core Networking - IPv4 (ICMP Echo)", Enabled = true, Action = "Allow" },
            new { Name = "WinRM-HTTP-In", DisplayName = "Windows Remote Management (HTTP-In)", Enabled = true, Action = "Allow" }
        });
    }

    [HttpPost("firewall/{hostname}/toggle")]
    public async Task<IActionResult> ToggleFirewallRule(string hostname, [FromBody] string ruleName)
    {
        var script = $"Toggle-NetFirewallRule -Name {ruleName}";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        return Ok(new { Message = result });
    }
}
