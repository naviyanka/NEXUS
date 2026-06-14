using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Core;
using Nexus.Gateway.Data;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SharePointController : ControllerBase
{
    private readonly ScriptExecutor _executor;
    private readonly NexusDbContext _db;

    public SharePointController(ScriptExecutor executor, NexusDbContext db)
    {
        _executor = executor;
        _db = db;
    }

    [HttpGet("farms")]
    public async Task<IActionResult> GetFarms()
    {
        var farms = await _db.MachineGroups
            .Where(g => g.Name.Contains("SharePoint"))
            .Select(g => g.Name)
            .ToListAsync();
        return Ok(farms);
    }

    [HttpGet("health/{hostname}")]
    public async Task<IActionResult> GetHealth(string hostname)
    {
        var script = "Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; " +
                     "$servers = Get-SPServer | Select Name,Role,Status | ConvertTo-Json -Compress; " +
                     "$services = Get-SPServiceInstance | Where {$_.Status -eq 'Online'} | Select TypeName,Status | ConvertTo-Json -Compress; " +
                     "@{ Servers = ($servers | ConvertFrom-Json); Services = ($services | ConvertFrom-Json) } | ConvertTo-Json -Depth 3";

        var result = await _executor.ExecutePowerShellAsync(script, hostname);

        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpGet("services/{hostname}")]
    public async Task<IActionResult> GetServices(string hostname)
    {
        var script = "Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; Get-SPServiceInstance | Select TypeName,Status,Server | ConvertTo-Json -Depth 2";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpPost("services/{hostname}/{typeName}/start")]
    public async Task<IActionResult> StartService(string hostname, string typeName)
    {
        var script = $"Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; Get-SPServiceInstance | Where {{$_.TypeName -eq '{typeName}'}} | Start-SPServiceInstance";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Started" });
    }

    [HttpPost("services/{hostname}/{typeName}/stop")]
    public async Task<IActionResult> StopService(string hostname, string typeName)
    {
        var script = $"Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; Get-SPServiceInstance | Where {{$_.TypeName -eq '{typeName}'}} | Stop-SPServiceInstance";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Stopped" });
    }

    [HttpGet("iis/{hostname}")]
    public async Task<IActionResult> GetIis(string hostname)
    {
        var script = "Import-Module WebAdministration; Get-Website | Select Name,State,PhysicalPath | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpGet("apppools/{hostname}")]
    public async Task<IActionResult> GetAppPools(string hostname)
    {
        var script = "Import-Module WebAdministration; Get-WebConfiguration system.applicationHost/applicationPools/add | Select name,state | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpPost("apppools/{hostname}/{name}/recycle")]
    public async Task<IActionResult> RecycleAppPool(string hostname, string name)
    {
        var script = $"Import-Module WebAdministration; Restart-WebAppPool -Name '{name}'";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(new { Message = "Recycled" });
    }

    [HttpGet("uls/{hostname}")]
    public async Task<IActionResult> GetUls(string hostname)
    {
        var script = "Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; Get-SPLogEvent -StartTime (Get-Date).AddHours(-1) | Select Timestamp,Area,Category,Level,Message | Select -First 100 | ConvertTo-Json";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }

    [HttpGet("configdiff")]
    public async Task<IActionResult> GetConfigDiff([FromQuery] string wfe, [FromQuery] string app)
    {
        var script = "Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; Get-SPWebApplication | Select Url,ApplicationPool,DefaultZone | ConvertTo-Json";

        var wfeResultTask = _executor.ExecutePowerShellAsync(script, wfe);
        var appResultTask = _executor.ExecutePowerShellAsync(script, app);

        await Task.WhenAll(wfeResultTask, appResultTask);

        return Ok(new
        {
            WfeHost = wfe,
            AppHost = app,
            WfeConfig = wfeResultTask.Result.Success ? JsonSerializer.Deserialize<object>(wfeResultTask.Result.Output) : new { Error = wfeResultTask.Result.Error },
            AppConfig = appResultTask.Result.Success ? JsonSerializer.Deserialize<object>(appResultTask.Result.Output) : new { Error = appResultTask.Result.Error }
        });
    }

    [HttpGet("upgrade-status/{hostname}")]
    public async Task<IActionResult> GetUpgradeStatus(string hostname)
    {
        var script = "Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue; " +
                     "$farm = (Get-SPFarm).BuildVersion | ConvertTo-Json -Compress; " +
                     "$local = Get-SPProduct -Local | Select DisplayName,PatchedVersion | ConvertTo-Json -Compress; " +
                     "@{ FarmBuildVersion = ($farm | ConvertFrom-Json); LocalProducts = ($local | ConvertFrom-Json) } | ConvertTo-Json -Depth 3";
        var result = await _executor.ExecutePowerShellAsync(script, hostname);
        if (!result.Success) return StatusCode(500, new { Error = result.Error });
        return Ok(JsonSerializer.Deserialize<object>(result.Output));
    }
}
