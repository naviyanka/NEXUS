using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Data;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ScriptLibraryController : ControllerBase
{
    private readonly NexusDbContext _context;

    public ScriptLibraryController(NexusDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetScripts([FromQuery] string? category, [FromQuery] string? tag)
    {
        var query = _context.SavedScripts.AsQueryable();
        if (!string.IsNullOrEmpty(category)) query = query.Where(s => s.Category == category);
        if (!string.IsNullOrEmpty(tag)) query = query.Where(s => s.Tags.Contains(tag));

        var scripts = await query.ToListAsync();
        return Ok(scripts);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetScript(int id)
    {
        var script = await _context.SavedScripts.FindAsync(id);
        if (script == null) return NotFound();
        return Ok(script);
    }

    [HttpPost]
    public async Task<IActionResult> SaveScript([FromBody] SavedScript script)
    {
        script.CreatedAt = DateTime.UtcNow;
        script.UpdatedAt = DateTime.UtcNow;
        script.Author = User.Identity?.Name ?? "Unknown";

        _context.SavedScripts.Add(script);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetScript), new { id = script.Id }, script);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateScript(int id, [FromBody] SavedScript script)
    {
        if (id != script.Id) return BadRequest();

        var existing = await _context.SavedScripts.FindAsync(id);
        if (existing == null) return NotFound();
        if (existing.IsBuiltIn) return Forbid(); // Cannot edit seeded scripts

        existing.Name = script.Name;
        existing.Description = script.Description;
        existing.Content = script.Content;
        existing.ScriptType = script.ScriptType;
        existing.Category = script.Category;
        existing.Tags = script.Tags;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteScript(int id)
    {
        var script = await _context.SavedScripts.FindAsync(id);
        if (script == null) return NotFound();
        if (script.IsBuiltIn) return Forbid(); // Cannot delete seeded scripts

        _context.SavedScripts.Remove(script);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
