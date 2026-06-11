# Phase 4 — Authentication System (Kerberos / NTLM / Local)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Implement authentication for the NEXUS web interface. Support three modes: Windows Authentication (Kerberos/NTLM — ideal for domain environments), Local accounts (username/password for non-domain access), and Both (allow either). Protect all API endpoints. Establish role/permission model.  
  
---  
  
## Context: What is NEXUS?  
NEXUS runs on a domain-joined server in a corporate lab. The primary auth mode is Windows Authentication — the same domain admin account used to manage servers authenticates seamlessly via the browser. A local fallback allows access from non-domain machines using a local admin account configured during install.  
  
---  
  
## Scope  
**In scope:**  
- Windows Authentication (Negotiate/Kerberos/NTLM)  
- Local account auth with hashed passwords stored in SQLite  
- JWT token issuance for both auth paths (browser session management)  
- `[Authorize]` attribute applied to all API controllers  
- Auth mode configurable via `nexus.yaml` (`mode: windows | local | both`)  
- `GET /api/auth/me` — returns current user info  
- `POST /api/auth/login` — local auth endpoint  
- `POST /api/auth/logout`  
- Permission model: `admin`, `operator`, `viewer`  
  
**Out of scope:**  
- Multi-user management UI (Phase 40 settings)  
- Fine-grained per-plugin permissions (future)  
  
---  
  
## Prerequisites  
- Phase 1 (.NET 8 service running)  
- Phase 5 (SQLite DB — for local account storage)  
  
---  
  
## Tech Stack  
| Component | Package |  
|-----------|---------|  
| Windows Auth | `Microsoft.AspNetCore.Authentication.Negotiate` |  
| JWT | `Microsoft.AspNetCore.Authentication.JwtBearer` |  
| Password hashing | `BCrypt.Net-Next` |  
| Claims | `System.Security.Claims` |  
  
---  
  
## Detailed Tasks  
  
### 1. Configure Authentication in Program.cs  
```csharp  
var authMode = nexusConfig.Auth.Mode; // "windows" | "local" | "both"  
  
builder.Services.AddAuthentication(options =>  
{  
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;  
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;  
})  
.AddJwtBearer(options => { /* JWT validation config */ });  
  
if (authMode is "windows" or "both")  
    builder.Services.AddAuthentication().AddNegotiate();  
  
builder.Services.AddAuthorization(options =>  
{  
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("nexus-admin"));  
    options.AddPolicy("OperatorOrAdmin", policy => policy.RequireRole("nexus-admin", "nexus-operator"));  
});  
```  
  
### 2. Create Auth Models  
```csharp  
// src/Nexus.Gateway/Models/AuthModels.cs  
public class LoginRequest { public string Username; public string Password; }  
public class AuthResult { public bool Success; public string? Token; public string? Error; public NexusUser? User; }  
public class NexusUser { public string Username; public string DisplayName; public string Role; public bool IsWindowsAuth; }  
public class LocalAccount { /* stored in SQLite */ public int Id; public string Username; public string PasswordHash; public string Role; }  
```  
  
### 3. Create Auth Service  
```csharp  
// src/Nexus.Gateway/Core/AuthService.cs  
public interface IAuthService  
{  
    Task<AuthResult> AuthenticateWindowsAsync(ClaimsPrincipal windowsPrincipal);  
    Task<AuthResult> AuthenticateLocalAsync(string username, string password);  
    string GenerateJwtToken(NexusUser user);  
    Task<bool> HasLocalAccountsAsync();  
    Task CreateLocalAccountAsync(string username, string password, string role);  
}  
```  
  
### 4. Create Auth Controller  
```csharp  
// src/Nexus.Gateway/Controllers/AuthController.cs  
[ApiController][Route("api/auth")]  
public class AuthController : ControllerBase  
{  
    [HttpPost("login")]      // Local login → returns JWT  
    [HttpGet("me")]          // Returns current user from JWT  
    [HttpPost("logout")]     // Clear session  
    [HttpGet("windows")]     // Windows auth endpoint → returns JWT for domain user  
}  
```  
  
### 5. Apply [Authorize] Globally  
```csharp  
// In Program.cs — require auth on all API routes  
app.UseAuthentication();  
app.UseAuthorization();  
  
// Or globally via filter:  
builder.Services.AddControllers(options =>  
    options.Filters.Add(new AuthorizeFilter()));  
      
// Exempt health endpoint:  
app.MapHealthChecks("/api/health").AllowAnonymous();  
```  
  
### 6. First-Run Setup  
If no local accounts exist in DB AND auth mode includes "local":  
- Accept first POST `/api/auth/setup` without authentication  
- Create the first admin account  
- Mark setup as complete in nexus.yaml  
  
---  
  
## API Endpoints Produced  
  
| Method | Endpoint | Auth Required |  
|--------|----------|--------------|  
| POST | `/api/auth/login` | No (local login) |  
| GET | `/api/auth/windows` | Windows Auth header |  
| GET | `/api/auth/me` | Yes (returns current user) |  
| POST | `/api/auth/logout` | Yes |  
| POST | `/api/auth/setup` | No (first-run only) |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Models/AuthModels.cs` | Create |  
| `src/Nexus.Gateway/Core/AuthService.cs` | Create |  
| `src/Nexus.Gateway/Controllers/AuthController.cs` | Create |  
| `src/Nexus.Gateway/Program.cs` | Modify (auth middleware) |  
  
---  
  
## Test Criteria  
- [ ] Windows auth: domain user can get a JWT token via `/api/auth/windows`  
- [ ] Local auth: `POST /api/auth/login` with valid creds returns JWT  
- [ ] Local auth: wrong password returns `401`  
- [ ] `GET /api/machines` without JWT returns `401`  
- [ ] `GET /api/machines` with valid JWT returns machine list  
- [ ] `GET /api/auth/me` returns correct username and role  
- [ ] First-run: `/api/auth/setup` works once, then returns 403  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **4-0:** JWT configuration + token generation  
- **4-1:** Windows Authentication (Negotiate/Kerberos)  
- **4-2:** Local account auth + BCrypt password hashing  
- **4-3:** AuthController + [Authorize] on all routes  
- **4-4:** First-run setup flow  
  
---  
  
## Notes for Coding Agent  
- JWT secret key must be auto-generated on first run and stored in `data/nexus.key` (not in config)  
- Windows Auth works automatically on domain-joined machines — browser sends Negotiate header  
- BCrypt salt rounds: 12 (secure but not too slow)  
- Token expiry: match `nexus.yaml` session_timeout_minutes (default 480 = 8 hours)  
- Frontend should store JWT in memory (not localStorage) — see Phase 10  
- Local accounts are stored in SQLite `local_accounts` table (see Phase 5 for schema)  