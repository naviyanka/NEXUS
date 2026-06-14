using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nexus.Gateway.Core;
using Nexus.Gateway.Data;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CredentialsController : ControllerBase
{
    private readonly NexusDbContext _context;
    private readonly VaultService _vault;

    public CredentialsController(NexusDbContext context, VaultService vault)
    {
        _context = context;
        _vault = vault;
    }

    [HttpGet]
    public async Task<IActionResult> GetCredentials()
    {
        // Never return passwords
        var credentials = await _context.Credentials
            .Select(c => new { c.Id, c.Name, c.Username, c.Domain, c.Description, c.CreatedAt })
            .ToListAsync();
        return Ok(credentials);
    }

    [HttpPost]
    public async Task<IActionResult> AddCredential([FromBody] CredentialCreateDto dto)
    {
        var cred = new Credential
        {
            Name = dto.Name,
            Username = dto.Username,
            Domain = dto.Domain,
            Description = dto.Description,
            CreatedAt = DateTime.UtcNow
        };

        // Encrypt and store password using DPAPI
        _context.Credentials.Add(cred);
        await _context.SaveChangesAsync(); // To get ID

        var secretKey = $"cred_{cred.Id}";
        _vault.StoreSecret(secretKey, dto.Password);

        cred.EncryptedPassword = secretKey; // Just store the reference key
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCredentials), new { id = cred.Id }, new { cred.Id, cred.Name });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCredential(int id)
    {
        var cred = await _context.Credentials.FindAsync(id);
        if (cred == null) return NotFound();

        _context.Credentials.Remove(cred);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public class CredentialCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
