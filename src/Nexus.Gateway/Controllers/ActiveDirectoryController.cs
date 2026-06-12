using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ActiveDirectoryController : ControllerBase
{
    // Active Directory integration generally leverages System.DirectoryServices.
    // In Phase 14 we setup the controller boundaries representing these hooks.

    [HttpGet("users")]
    public IActionResult GetUsers()
    {
        // Mock response
        return Ok(new[] {
            new { Username = "jdoe", DisplayName = "John Doe", Enabled = true },
            new { Username = "asmith", DisplayName = "Alice Smith", Enabled = true }
        });
    }

    [HttpGet("groups")]
    public IActionResult GetGroups()
    {
        return Ok(new[] {
            new { Name = "Domain Admins", Description = "Designated administrators of the domain" },
            new { Name = "IT Support", Description = "IT Support Team" }
        });
    }
}
