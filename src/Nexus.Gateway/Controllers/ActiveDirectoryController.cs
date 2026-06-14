using System.DirectoryServices.AccountManagement;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Nexus.Gateway.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ActiveDirectoryController : ControllerBase
{
    // Assume run on DC01 or similar domain joined machine
    private PrincipalContext GetContext() => new PrincipalContext(ContextType.Domain);

    [HttpGet("users")]
    public IActionResult GetUsers()
    {
        try
        {
            using var ctx = GetContext();
            using var searcher = new PrincipalSearcher(new UserPrincipal(ctx));
            var users = searcher.FindAll().Select(p => (UserPrincipal)p).Select(u => new
            {
                Username = u.SamAccountName,
                DisplayName = u.DisplayName,
                Email = u.EmailAddress,
                IsEnabled = u.Enabled ?? false,
                LastLogon = u.LastLogon
            });
            return Ok(users);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpGet("users/{username}")]
    public IActionResult GetUser(string username)
    {
        try
        {
            using var ctx = GetContext();
            var user = UserPrincipal.FindByIdentity(ctx, username);
            if (user == null) return NotFound();

            return Ok(new
            {
                Username = user.SamAccountName,
                DisplayName = user.DisplayName,
                Email = user.EmailAddress,
                IsEnabled = user.Enabled ?? false,
                LastLogon = user.LastLogon,
                AccountLockoutTime = user.AccountLockoutTime,
                IsAccountLockedOut = user.IsAccountLockedOut()
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpPost("users/{username}/enable")]
    public IActionResult EnableUser(string username)
    {
        try
        {
            using var ctx = GetContext();
            var user = UserPrincipal.FindByIdentity(ctx, username);
            if (user == null) return NotFound();

            user.Enabled = true;
            user.Save();
            return Ok(new { Message = "User enabled" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpPost("users/{username}/disable")]
    public IActionResult DisableUser(string username)
    {
        try
        {
            using var ctx = GetContext();
            var user = UserPrincipal.FindByIdentity(ctx, username);
            if (user == null) return NotFound();

            user.Enabled = false;
            user.Save();
            return Ok(new { Message = "User disabled" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpPost("users/{username}/unlock")]
    public IActionResult UnlockUser(string username)
    {
        try
        {
            using var ctx = GetContext();
            var user = UserPrincipal.FindByIdentity(ctx, username);
            if (user == null) return NotFound();

            user.UnlockAccount();
            user.Save();
            return Ok(new { Message = "User unlocked" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpPost("users/{username}/reset-password")]
    public IActionResult ResetPassword(string username, [FromBody] string newPassword)
    {
        try
        {
            using var ctx = GetContext();
            var user = UserPrincipal.FindByIdentity(ctx, username);
            if (user == null) return NotFound();

            user.SetPassword(newPassword);
            user.Save();
            return Ok(new { Message = "Password reset" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpGet("groups")]
    public IActionResult GetGroups()
    {
        try
        {
            using var ctx = GetContext();
            using var searcher = new PrincipalSearcher(new GroupPrincipal(ctx));
            var groups = searcher.FindAll().Select(p => (GroupPrincipal)p).Select(g => new
            {
                Name = g.Name,
                Description = g.Description
            });
            return Ok(groups);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpGet("groups/{name}/members")]
    public IActionResult GetGroupMembers(string name)
    {
        try
        {
            using var ctx = GetContext();
            var group = GroupPrincipal.FindByIdentity(ctx, name);
            if (group == null) return NotFound();

            var members = group.GetMembers(false).Select(m => new
            {
                Name = m.Name,
                SamAccountName = m.SamAccountName
            });
            return Ok(members);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpGet("computers")]
    public IActionResult GetComputers()
    {
        try
        {
            using var ctx = GetContext();
            using var searcher = new PrincipalSearcher(new ComputerPrincipal(ctx));
            var computers = searcher.FindAll().Select(p => (ComputerPrincipal)p).Select(c => new
            {
                Name = c.Name,
                Description = c.Description
            });
            return Ok(computers);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }

    [HttpGet("domain-info")]
    public IActionResult GetDomainInfo()
    {
        try
        {
            using var ctx = GetContext();
            return Ok(new
            {
                DomainName = ctx.Name,
                ConnectedServer = ctx.ConnectedServer
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = ex.Message });
        }
    }
}
