using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nexus.Gateway.Core;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class OrchestrationController : ControllerBase
{
    private readonly ScriptExecutor _executor;

    public OrchestrationController(ScriptExecutor executor)
    {
        _executor = executor;
    }

    [HttpPost("run")]
    public async Task<IActionResult> RunTask([FromBody] OrchestrationRequest request)
    {
        // Execute scripts in parallel against target hostnames
        var tasks = request.TargetHostnames.Select(async host => {
            var res = await _executor.ExecutePowerShellAsync(request.ScriptContent, host);
            return new { Host = host, Result = res };
        });

        var results = await Task.WhenAll(tasks);
        return Ok(results);
    }
}

public class OrchestrationRequest
{
    public string ScriptContent { get; set; } = string.Empty;
    public List<string> TargetHostnames { get; set; } = new List<string>();
}
