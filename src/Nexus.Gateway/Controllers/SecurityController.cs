using System.Text.Json;
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
    private readonly AuditLogger _auditLogger;

    public SecurityController(ScriptExecutor executor, AuditLogger auditLogger)
    {
        _executor = executor;
        _auditLogger = auditLogger;
    }

    [HttpGet("firewall/{hostname}")]
    public async Task<IActionResult> GetFirewallRules(string hostname)
    {
        var script = "Get-NetFirewallRule | Where {$_.Enabled -eq 'True'} | Select-Object Name,DisplayName,Direction,Action,Profile | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpPost("firewall/{hostname}/enable")]
    public async Task<IActionResult> EnableFirewallRule(string hostname, [FromBody] FirewallRequest request)
    {
        var script = $"Set-NetFirewallRule -Name '{request.RuleName}' -Enabled True";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Firewall.Enable", hostname, $"Rule: {request.RuleName}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Enabled" });
    }

    [HttpPost("firewall/{hostname}/disable")]
    public async Task<IActionResult> DisableFirewallRule(string hostname, [FromBody] FirewallRequest request)
    {
        var script = $"Set-NetFirewallRule -Name '{request.RuleName}' -Enabled False";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Firewall.Disable", hostname, $"Rule: {request.RuleName}", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Disabled" });
    }

    [HttpGet("defender/{hostname}")]
    public async Task<IActionResult> GetDefender(string hostname)
    {
        var script = "Get-MpComputerStatus | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpPost("defender/{hostname}/scan")]
    public async Task<IActionResult> StartDefenderScan(string hostname)
    {
        var script = "Start-MpScan -ScanType QuickScan";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        var username = User.Identity?.Name ?? "Unknown";
        await _auditLogger.LogAsync(username, "Defender.Scan", hostname, "QuickScan", result.Success);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Scan started" });
    }

    [HttpGet("local-users/{hostname}")]
    public async Task<IActionResult> GetLocalUsers(string hostname)
    {
        var script = "Get-LocalUser | Select-Object Name,Enabled,FullName,Description | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpGet("local-groups/{hostname}")]
    public async Task<IActionResult> GetLocalGroups(string hostname)
    {
        var script = "Get-LocalGroup | Select-Object Name,Description | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }
}

public class FirewallRequest
{
    public string RuleName { get; set; } = string.Empty;
}
