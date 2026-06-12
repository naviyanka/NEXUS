using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Data;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MachineController : ControllerBase
{
    private readonly NexusDbContext _context;

    public MachineController(NexusDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetMachines()
    {
        var machines = await _context.Machines.Include(m => m.MachineGroup).ToListAsync();
        return Ok(machines);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetMachine(int id)
    {
        var machine = await _context.Machines.Include(m => m.MachineGroup).FirstOrDefaultAsync(m => m.Id == id);
        if (machine == null) return NotFound();
        return Ok(machine);
    }

    [HttpPost]
    public async Task<IActionResult> CreateMachine([FromBody] Machine machine)
    {
        _context.Machines.Add(machine);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetMachine), new { id = machine.Id }, machine);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateMachine(int id, [FromBody] Machine machine)
    {
        if (id != machine.Id) return BadRequest();
        _context.Entry(machine).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMachine(int id)
    {
        var machine = await _context.Machines.FindAsync(id);
        if (machine == null) return NotFound();

        _context.Machines.Remove(machine);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
