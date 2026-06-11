# Phase 9 — Event Bus & Scheduler (Quartz.NET)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the internal event bus (plugin-to-plugin communication) and the cron-style job scheduler. The event bus allows plugins to react to events from other plugins (e.g., "machine went offline" triggers an alert). The scheduler runs saved scripts on a cron schedule stored in SQLite.  
  
---  
  
## Context  
NEXUS plugins are isolated but sometimes need to talk to each other or react to system events. The event bus provides this without creating hard dependencies. The scheduler allows NEXUS to run maintenance scripts automatically (e.g., clear temp files every night at 2am on all SP servers).  
  
---  
  
## Scope  
**In scope:**  
- `EventBus.cs` — in-process pub/sub for plugin events  
- Standard events: `MachineOnline`, `MachineOffline`, `ScriptExecuted`, `PluginLoaded`, `AlertTriggered`  
- `NexusScheduler.cs` — Quartz.NET wrapper for cron jobs  
- Scheduler reads jobs from `scheduled_jobs` SQLite table  
- Job execution calls ScriptExecutor with stored targets/script  
- API: `GET/POST/PUT/DELETE /api/scheduler/jobs`  
- API: `POST /api/scheduler/jobs/{id}/run-now` — immediate trigger  
  
**Out of scope:**  
- Alert rules evaluation (Phase 41)  
- Notification delivery (Phase 41)  
  
---  
  
## Event Bus  
  
```csharp  
// src/Nexus.Gateway/Core/EventBus.cs  
public interface IEventBus  
{  
    void Subscribe<T>(Action<T> handler) where T : NexusEvent;  
    void Publish<T>(T @event) where T : NexusEvent;  
}  
  
// Standard events  
public record MachineOfflineEvent(string Hostname, DateTime Timestamp) : NexusEvent;  
public record MachineOnlineEvent(string Hostname, DateTime Timestamp) : NexusEvent;  
public record ScriptExecutedEvent(string PluginId, string Hostname, bool Success, DateTime Timestamp) : NexusEvent;  
public record PluginLoadedEvent(string PluginId, DateTime Timestamp) : NexusEvent;  
```  
  
## SignalR Real-Time Protocol — Mandatory Constraints

### Connection & Hub Constraints
- All clients MUST connect to a single Hub: `/_ws/nexus`
- Multiple hubs are strictly prohibited to prevent connection exhaustion.
- Authentication must use the standard bearer token attached to the connection.

### Topic-Based Subscriptions
Because there is only one Hub, clients must explicitly subscribe to topics they care about.

```csharp
public class NexusHub : Hub
{
    // Client calls this to listen to a specific machine or job
    public async Task Subscribe(string topicId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, topicId);
    }

    public async Task Unsubscribe(string topicId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, topicId);
    }
}
```

### Mandatory Event Schemas

All messages sent from server to client MUST use this wrapper:
```typescript
interface SignalREvent<T> {
  type: string;            // e.g. "machine.status_changed", "job.progress"
  timestamp: string;       // ISO-8601 UTC
  topic: string;           // e.g. "machine:dc01", "job:12345", "global"
  payload: T;              // The actual event data
}
```

## Quartz.NET Scheduler  
  
```csharp  
// src/Nexus.Gateway/Core/NexusScheduler.cs  
// Loads all enabled jobs from scheduled_jobs table on startup  
// Creates Quartz triggers for each cron expression  
// On trigger: calls ScriptExecutor with job's script/targets  
// Updates last_run, last_result, next_run in DB after each execution  
// Supports: add job, remove job, pause/resume, run-now  
  
// Register in Program.cs:  
builder.Services.AddQuartz(q => { q.UseMicrosoftDependencyInjectionJobFactory(); });  
builder.Services.AddQuartzHostedService(opt => opt.WaitForJobsToComplete = true);  
```  
  
## Scheduler Models  
```csharp  
public class ScheduledJobDto  
{  
    public int Id { get; set; }  
    public string Name { get; set; }  
    public string CronExpression { get; set; }   // "0 2 * * *"  
    public string CronDescription { get; set; }  // "Every day at 2:00 AM"  
    public List<string> Targets { get; set; }  
    public string ScriptPath { get; set; }  
    public string Language { get; set; }  
    public bool Enabled { get; set; }  
    public DateTime? LastRun { get; set; }  
    public string? LastResult { get; set; }  
    public DateTime? NextRun { get; set; }  
}  
```  
  
## API Endpoints  
  
| Method | Endpoint | Description |  
|--------|----------|-------------|  
| GET | `/api/scheduler/jobs` | List all scheduled jobs |  
| POST | `/api/scheduler/jobs` | Create new job |  
| PUT | `/api/scheduler/jobs/{id}` | Update job |  
| DELETE | `/api/scheduler/jobs/{id}` | Delete job |  
| POST | `/api/scheduler/jobs/{id}/toggle` | Enable/disable |  
| POST | `/api/scheduler/jobs/{id}/run-now` | Immediate execution |  
| GET | `/api/scheduler/jobs/{id}/history` | Execution history |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Core/EventBus.cs` | Create |  
| `src/Nexus.Gateway/Core/NexusScheduler.cs` | Create |  
| `src/Nexus.Gateway/Controllers/SchedulerController.cs` | Create |  
| `src/Nexus.Gateway/Program.cs` | Modify (Quartz + EventBus DI) |  
  
---  
  
## Test Criteria  
- [ ] EventBus: subscriber receives `MachineOfflineEvent` when machine goes offline  
- [ ] Multiple subscribers on same event type all receive it  
- [ ] `POST /api/scheduler/jobs` creates a job that appears in Quartz  
- [ ] Job with cron `"*/1 * * * *"` (every minute) runs within 65 seconds  
- [ ] `POST /api/scheduler/jobs/1/run-now` triggers immediate execution  
- [ ] Job results (success/failure) are written back to scheduled_jobs table  
- [ ] Disabled job (`enabled: false`) does not execute even when due  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **9-0:** EventBus implementation + standard event types  
- **9-1:** Quartz.NET setup + job factory  
- **9-2:** DB-backed job loading (reads from scheduled_jobs table)  
- **9-3:** SchedulerController + CRUD API  
- **9-4:** Run-now + execution history  
  
---  
  
## Notes for Coding Agent  
- EventBus must be thread-safe — use `ConcurrentDictionary` for subscriber lists  
- Quartz cron format is `seconds minutes hours day month weekday` (6 fields, not 5) — or use `CronExpression.IsValidExpression()`  
- Include a cron expression parser/describer to show human-readable descriptions  
- Scheduler jobs run as the NEXUS service account — they use the credential_id from the job definition  
- Job execution is async — don't block the Quartz thread  
- Execution history: keep last 50 runs per job in the audit_log table 

---

## ⚡ Integration Update (Replaces Custom Build)

**Do NOT build custom Kerberos/NTLM middleware.** Use the official Microsoft NuGet:

```bash
dotnet add package Microsoft.AspNetCore.Authentication.Negotiate
```

```csharp
// Program.cs — this IS the entire Kerberos/NTLM implementation
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();
builder.Services.AddAuthorization();
```

This is exactly how Windows Admin Center handles domain auth. One package, one line. The Negotiate handler automatically tries Kerberos first, falls back to NTLM. No custom code needed for the handshake.

**Remaining work in this phase:**
- JWT issuance after Negotiate validation (still needed for SignalR WS auth)
- Authorization policies (ReadOnly / Operator / Admin)
- Local auth fallback using `npx shadcn add login-01` for the UI page

**Estimated effort revised: 0.5 days** (was 1 day)