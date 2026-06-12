using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ScriptLibraryController : ControllerBase
{
    private readonly string _scriptsDir;

    public ScriptLibraryController()
    {
        _scriptsDir = Path.Combine(Directory.GetCurrentDirectory(), "scripts");
        if (!Directory.Exists(_scriptsDir)) Directory.CreateDirectory(_scriptsDir);
    }

    [HttpGet]
    public IActionResult GetScripts()
    {
        var scripts = Directory.GetFiles(_scriptsDir, "*.ps1").Select(f => new {
            Name = Path.GetFileName(f),
            Path = f
        });
        return Ok(scripts);
    }

    [HttpPost]
    public async Task<IActionResult> SaveScript([FromBody] ScriptDto script)
    {
        var path = Path.Combine(_scriptsDir, script.Name);
        await File.WriteAllTextAsync(path, script.Content);
        return Ok(new { Message = "Saved" });
    }
}

public class ScriptDto
{
    public string Name { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}
