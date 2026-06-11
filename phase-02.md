# Phase 2 — WinRM / CIM Connection Engine  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the core agentless connection engine that communicates with all target Windows machines via WinRM and CIM. This is the "remote arms" of NEXUS — everything from getting machine status to running remote commands flows through this engine. No agents needed on target machines.  
  
---  
  
## Context: What is NEXUS?  
NEXUS manages all domain machines without installing any software on them. It uses Windows Remote Management (WinRM) and CIM (Common Information Model / WMI successor) for all remote operations. The connection engine in this phase manages connection pooling, retry logic, and the abstractions that all plugins use to talk to remote machines.  
  
---  
  
## Scope  
**In scope:**  
- `WinRmClient.cs` — Core remote execution client (PowerShell remoting via `Runspace`)  
- `CimClient.cs` — CIM/WMI queries (hardware info, OS stats, processes, services)  
- Connection pool — reuse sessions per machine for performance  
- `MachineStatus` model — online/offline + basic metrics  
- Status polling loop — background service that pings all machines every N seconds  
- `IMachineStatusService` interface — abstraction used by all plugins  
- API endpoint: `GET /api/machines` and `GET /api/machines/{hostname}`  
  
**Out of scope:**  
- Script execution with parameters (Phase 3)  
- Authentication credential selection (Phase 4/8)  
- Per-machine detailed plugin data (Phase 15+)  
  
---  
  
## Prerequisites  
- Phase 0 (solution structure)  
- Phase 1 (.NET 8 service running)  
  
---  
  
## Tech Stack for This Phase  
| Component | Package/Namespace |  
|-----------|-------------------|  
| PowerShell Remoting | `System.Management.Automation` (PowerShell SDK) |  
| CIM/WMI | `Microsoft.Management.Infrastructure` |  
| Background polling | `IHostedService` / `BackgroundService` |  
| DI | `Microsoft.Extensions.DependencyInjection` |  
  
---  
  
## Detailed Tasks  
  
### 1. Create Machine Models  
```csharp  
// src/Nexus.Gateway/Models/Machine.cs  
public class MachineDefinition  
{  
    public string Hostname { get; set; } = "";  
    public string DisplayName { get; set; } = "";  
    public string? GroupId { get; set; }  
    public string Role { get; set; } = "";  
    public List<string> Tags { get; set; } = new();  
    public string Icon { get; set; } = "server";  
    public string? CredentialId { get; set; }  
}  
  
public class MachineStatus  
{  
    public string Hostname { get; set; } = "";  
    public string DisplayName { get; set; } = "";  
    public bool IsOnline { get; set; }  
    public DateTime LastSeen { get; set; }  
    public DateTime LastChecked { get; set; }  
    public string? OsVersion { get; set; }  
    public double? CpuPercent { get; set; }  
    public long? RamTotalMb { get; set; }  
    public long? RamFreeMb { get; set; }  
    public string? Uptime { get; set; }  
    public string? Error { get; set; }  
    public List<string> Tags { get; set; } = new();  
    public string? GroupId { get; set; }  
    public string Icon { get; set; } = "server";  
}  
  
public class MachineGroup  
{  
    public string Id { get; set; } = "";  
    public string Label { get; set; } = "";  
    public string Color { get; set; } = "#888888";  
    public List<string> Machines { get; set; } = new();  
}  
```  
  
### 2. Create WinRM Client  
```csharp  
// src/Nexus.Gateway/Core/WinRmClient.cs  
public interface IWinRmClient  
{  
    Task<WinRmResult> ExecuteAsync(string hostname, string script, NetworkCredential? cred = null);  
    Task<bool> TestConnectionAsync(string hostname);  
}  
  
public class WinRmResult  
{  
    public bool Success { get; set; }  
    public string Output { get; set; } = "";  
    public string Error { get; set; } = "";  
    public int ExitCode { get; set; }  
}  
  
public class WinRmClient : IWinRmClient  
{  
    // Use WSManConnectionInfo for PowerShell remoting  
    // Handle Kerberos/NTLM/Basic auth via NetworkCredential  
    // Implement connection pooling with ConcurrentDictionary<string, RunspacePool>  
    // Implement retry logic (3 attempts, exponential backoff)  
    // Timeout: 30 seconds per operation default  
}  
```  
  
### 3. Create CIM Client  
```csharp  
// src/Nexus.Gateway/Core/CimClient.cs  
public interface ICimClient  
{  
    Task<MachineBasicStats> GetBasicStatsAsync(string hostname, NetworkCredential? cred = null);  
    Task<bool> PingAsync(string hostname);  
}  
  
public class MachineBasicStats  
{  
    public string OsVersion { get; set; } = "";  
    public string OsCaption { get; set; } = "";  
    public double CpuPercent { get; set; }  
    public long TotalRamMb { get; set; }  
    public long FreeRamMb { get; set; }  
    public TimeSpan Uptime { get; set; }  
    public DateTime LastBoot { get; set; }  
    public string ComputerName { get; set; } = "";  
}  
```  
  
CIM queries to use:  
```csharp  
// CPU: SELECT LoadPercentage FROM Win32_Processor  
// RAM: SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem    
// OS:  SELECT Caption, Version, LastBootUpTime FROM Win32_OperatingSystem  
```  
  
### 4. Create Machine Config Loader  
```csharp  
// src/Nexus.Gateway/Core/MachineConfigLoader.cs  
// Loads config/machines.yaml on startup  
// Returns List<MachineDefinition> and List<MachineGroup>  
// Supports hot-reload via FileSystemWatcher  
```  
  
### 5. Create Machine Status Background Service  
```csharp  
// src/Nexus.Gateway/Core/MachineStatusService.cs  
public class MachineStatusService : BackgroundService, IMachineStatusService  
{  
    // Poll all machines every 30 seconds (configurable via nexus.yaml)  
    // Store current statuses in ConcurrentDictionary<string, MachineStatus>  
    // Fire events when machine goes online/offline  
    // Expose GetAllStatuses() and GetStatus(hostname) methods  
}  
```  
  
### 6. Create Machines API Controller  
```csharp  
// src/Nexus.Gateway/Controllers/MachinesController.cs  
[ApiController]  
[Route("api/machines")]  
public class MachinesController : ControllerBase  
{  
    [HttpGet]  
    public IActionResult GetAll()   
        => Ok(statusService.GetAllStatuses()); // Returns List<MachineStatus>  
  
    [HttpGet("{hostname}")]  
    public IActionResult GetOne(string hostname)   
        => Ok(statusService.GetStatus(hostname));  
  
    [HttpPost("{hostname}/ping")]  
    public async Task<IActionResult> Ping(string hostname)  
        => Ok(await cimClient.PingAsync(hostname));  
  
    [HttpGet("groups")]  
    public IActionResult GetGroups()   
        => Ok(configLoader.GetGroups());  
}  
```  
  
### 7. Register Services in DI (update Program.cs)  
```csharp  
builder.Services.AddSingleton<IMachineConfigLoader, MachineConfigLoader>();  
builder.Services.AddSingleton<ICimClient, CimClient>();  
builder.Services.AddSingleton<IWinRmClient, WinRmClient>();  
builder.Services.AddSingleton<IMachineStatusService, MachineStatusService>();  
builder.Services.AddHostedService(provider =>   
    (MachineStatusService)provider.GetRequiredService<IMachineStatusService>());  
```  
  
---  
  
## API Endpoints Produced  
  
| Method | Endpoint | Response |  
|--------|----------|----------|  
| GET | `/api/machines` | `List<MachineStatus>` |  
| GET | `/api/machines/{hostname}` | `MachineStatus` |  
| POST | `/api/machines/{hostname}/ping` | `{ online: bool, latencyMs: int }` |  
| GET | `/api/machines/groups` | `List<MachineGroup>` |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Models/Machine.cs` | Create |  
| `src/Nexus.Gateway/Core/WinRmClient.cs` | Create |  
| `src/Nexus.Gateway/Core/CimClient.cs` | Create |  
| `src/Nexus.Gateway/Core/MachineConfigLoader.cs` | Create |  
| `src/Nexus.Gateway/Core/MachineStatusService.cs` | Create |  
| `src/Nexus.Gateway/Controllers/MachinesController.cs` | Create |  
| `src/Nexus.Gateway/Program.cs` | Modify (add DI registrations) |  
  
---  
  
## Test Criteria  
- [ ] `GET /api/machines` returns JSON list of machine statuses from `config/machines.yaml`  
- [ ] Online machines show `isOnline: true` with CPU/RAM/uptime populated  
- [ ] Offline machines show `isOnline: false` with `error` message  
- [ ] `POST /api/machines/DC01/ping` returns response within 5 seconds  
- [ ] Status updates every 30 seconds automatically  
- [ ] Machine going offline is reflected on next poll cycle  
- [ ] `GET /api/machines/groups` returns group definitions from machines.yaml  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **2-0:** Machine models + MachineConfigLoader (YAML parsing)  
- **2-1:** CimClient (connection + basic stats query)  
- **2-2:** WinRmClient (connection + test)  
- **2-3:** MachineStatusService (background polling)  
- **2-4:** MachinesController + DI wiring  
  
---  
  
## Notes for Coding Agent  
- Use `Microsoft.Management.Infrastructure.CimSession` NOT the old `System.Management.ManagementScope` (WMI)  
- WinRM must be enabled on target machines: `Enable-PSRemoting -Force`  
- Connection pool per hostname — don't create new sessions on every request  
- Handle `CimException` and `PSRemotingException` gracefully — machines going offline is NORMAL  
- The polling interval should be read from `nexus.yaml` service config  
- For development/testing without real VMs, implement a mock mode that returns fake data 