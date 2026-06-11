# Phase 5 — SQLite Database Layer  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Set up the SQLite database using Entity Framework Core. Define all tables needed by NEXUS: audit log, script library, scheduled jobs, local accounts, credential metadata, and dashboard layout persistence. Run initial migrations. Provide a clean repository pattern abstraction.  
  
---  
  
## Context  
NEXUS uses SQLite for all persistent data. No external database server needed — SQLite lives in `data/nexus.db` alongside the service. EF Core manages the schema via code-first migrations.  
  
---  
  
## Scope  
**In scope:**  
- `NexusDbContext.cs` with all table definitions  
- EF Core code-first migrations  
- Repository pattern: `IAuditRepository`, `IScriptRepository`, `IJobRepository`  
- Auto-migrate on startup  
- Schema for: `audit_log`, `script_library`, `scheduled_jobs`, `local_accounts`, `credential_metadata`, `dashboard_layouts`, `alert_rules`  
  
**Out of scope:**  
- Populating data (done by later phases)  
- Advanced query optimization  
  
---  
  
## Prerequisites  
- Phase 1 (.NET 8 service)  
  
---  
  
## Database Schema  
  
### Table: audit_log  
```sql  
CREATE TABLE audit_log (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    timestamp TEXT NOT NULL,  
    username TEXT NOT NULL,  
    action TEXT NOT NULL,           -- "run_script", "restart_service", etc  
    target_machine TEXT,  
    plugin_id TEXT,  
    details TEXT,                   -- JSON blob of action details  
    result TEXT,                    -- "success" | "failure"  
    error_message TEXT,  
    ip_address TEXT  
);  
```  
  
### Table: script_library  
```sql  
CREATE TABLE script_library (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    name TEXT NOT NULL,  
    description TEXT,  
    language TEXT NOT NULL,         -- "powershell" | "python" | "batch"  
    content TEXT NOT NULL,          -- Script content  
    tags TEXT,                      -- JSON array of tags  
    created_by TEXT,  
    created_at TEXT,  
    modified_at TEXT,  
    run_count INTEGER DEFAULT 0,  
    last_run_at TEXT  
);  
```  
  
### Table: scheduled_jobs  
```sql  
CREATE TABLE scheduled_jobs (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    name TEXT NOT NULL,  
    plugin_id TEXT,  
    script_library_id INTEGER,  
    cron_expression TEXT NOT NULL,  -- "0 2 * * *" = 2am daily  
    targets TEXT NOT NULL,          -- JSON array of target hostnames/groups  
    language TEXT NOT NULL,  
    enabled INTEGER DEFAULT 1,  
    last_run TEXT,  
    last_result TEXT,               -- "success" | "failure"  
    next_run TEXT,  
    created_by TEXT,  
    created_at TEXT  
);  
```  
  
### Table: local_accounts  
```sql  
CREATE TABLE local_accounts (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    username TEXT NOT NULL UNIQUE,  
    password_hash TEXT NOT NULL,    -- BCrypt hash  
    role TEXT NOT NULL,             -- "admin" | "operator" | "viewer"  
    created_at TEXT,  
    last_login TEXT,  
    is_active INTEGER DEFAULT 1  
);  
```  
  
### Table: credential_metadata  
```sql  
-- Stores names/IDs only — actual credentials in DPAPI vault (Phase 8)  
CREATE TABLE credential_metadata (  
    id TEXT PRIMARY KEY,            -- e.g., "domain-admin"  
    display_name TEXT NOT NULL,  
    username TEXT NOT NULL,  
    domain TEXT,  
    type TEXT NOT NULL,             -- "domain" | "local"  
    created_at TEXT,  
    last_used TEXT  
);  
```  
  
### Table: dashboard_layouts  
```sql  
CREATE TABLE dashboard_layouts (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    username TEXT NOT NULL,         -- Per-user layout  
    layout_json TEXT NOT NULL,      -- JSON: panel positions, sizes  
    modified_at TEXT  
);  
```  
  
### Table: alert_rules  
```sql  
CREATE TABLE alert_rules (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    name TEXT NOT NULL,  
    condition TEXT NOT NULL,        -- JSON: trigger conditions  
    action TEXT NOT NULL,           -- JSON: notification channels  
    enabled INTEGER DEFAULT 1,  
    created_at TEXT  
);  
```  
  
## EF Core Setup  
  
```csharp  
// src/Nexus.Gateway/Data/NexusDbContext.cs  
public class NexusDbContext : DbContext  
{  
    public DbSet<AuditLogEntry> AuditLog { get; set; }  
    public DbSet<ScriptLibraryItem> ScriptLibrary { get; set; }  
    public DbSet<ScheduledJob> ScheduledJobs { get; set; }  
    public DbSet<LocalAccount> LocalAccounts { get; set; }  
    public DbSet<CredentialMetadata> CredentialMetadata { get; set; }  
    public DbSet<DashboardLayout> DashboardLayouts { get; set; }  
    public DbSet<AlertRule> AlertRules { get; set; }  
      
    protected override void OnConfiguring(DbContextOptionsBuilder options)  
        => options.UseSqlite($"Data Source={dbPath}");  
}  
```  
  
Auto-migrate in Program.cs:  
```csharp  
// Run migrations on startup  
using var scope = app.Services.CreateScope();  
var db = scope.ServiceProvider.GetRequiredService<NexusDbContext>();  
db.Database.Migrate();  
```  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Data/NexusDbContext.cs` | Create |  
| `src/Nexus.Gateway/Data/Entities/*.cs` | Create (one per table) |  
| `src/Nexus.Gateway/Data/Repositories/*.cs` | Create |  
| `src/Nexus.Gateway/Data/Migrations/` | Generate via dotnet ef |  
| `src/Nexus.Gateway/Program.cs` | Modify (add DbContext, auto-migrate) |  
  
---  
  
## Test Criteria  
- [ ] Service starts and `data/nexus.db` is created automatically  
- [ ] All 7 tables exist with correct schema after migration  
- [ ] `dotnet ef migrations add Initial` produces valid migration file  
- [ ] `db.Database.Migrate()` runs without errors on fresh install  
- [ ] `db.Database.Migrate()` is idempotent (safe to run multiple times)  
- [ ] Repository pattern: `auditRepo.AddEntry(...)` writes to DB correctly  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **5-0:** EF Core setup + DbContext + connection string  
- **5-1:** Entity models (all table classes)  
- **5-2:** Initial migration generation  
- **5-3:** Repository pattern implementation  
- **5-4:** Auto-migrate on startup + DI registration  
  
---  
  
## Notes for Coding Agent  
- SQLite file path comes from `nexus.yaml` `database.path` setting  
- Use `Directory.CreateDirectory()` to ensure `data/` exists before opening SQLite  
- All DateTime values stored as TEXT (ISO 8601) in SQLite — use `DateTime.UtcNow.ToString("o")`  
- Migrations folder: `src/Nexus.Gateway/Data/Migrations/`  
- Run: `dotnet ef migrations add InitialCreate --project src/Nexus.Gateway` to generate migration  