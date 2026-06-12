using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Data;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MachineGroupController : ControllerBase
{
    private readonly NexusDbContext _context;

    public MachineGroupController(NexusDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetGroups()
    {
        var groups = await _context.MachineGroups.ToListAsync();
        return Ok(groups);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetGroup(int id)
    {
        var group = await _context.MachineGroups.FindAsync(id);
        if (group == null) return NotFound();
        return Ok(group);
    }

    [HttpPost]
    public async Task<IActionResult> CreateGroup([FromBody] MachineGroup group)
    {
        _context.MachineGroups.Add(group);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetGroup), new { id = group.Id }, group);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateGroup(int id, [FromBody] MachineGroup group)
    {
        if (id != group.Id) return BadRequest();
        _context.Entry(group).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        var group = await _context.MachineGroups.FindAsync(id);
        if (group == null) return NotFound();

        _context.MachineGroups.Remove(group);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
