# Phase 3 — Script Executor (PS / Python / Batch / VBS)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the multi-language script execution engine. This is what makes NEXUS's plugin system powerful: any plugin can ship scripts in PowerShell, Python, Batch, or VBScript and they all run through this single unified executor. The executor handles targeting (single machine, group, or all), parallel vs sequential execution, output streaming, and timeout management.  
  
---  
  
## Context: What is NEXUS?  
Plugins ship scripts in one or more languages. When a user triggers a plugin action (e.g., "Reset IIS"), the frontend calls the script executor API with: script path, target machines, language, and execution options. The executor runs the script on each target via WinRM and streams back output in real-time. This is the core value of NEXUS's one-click-multi-machine feature.  
  
---  
  
## Scope  
**In scope:**  
- `ScriptExecutor.cs` — core multi-language script runner  
- Support for: PowerShell (.ps1), Python (.py), Batch (.bat/.cmd), VBScript (.vbs)  
- Execution targets: single / list / group / all  
- Parallel and sequential execution modes  
- Streaming output via SignalR (preparation — actual streaming in Phase 7)  
- `ScriptResult` model with per-machine output, exit codes, errors  
- API endpoint: `POST /api/scripts/run`  
- Script file sandboxing (scripts must be in `plugins/*/scripts/` directory)  
  
**Out of scope:**  
- Script library (saving/browsing scripts) — Phase 18  
- Scheduled execution — Phase 9  
- Streaming output to browser — Phase 7 (this phase collects full output)  
  
---  
  
## Prerequisites  
- Phase 2 (WinRM/CIM engine — needed to run scripts on remote machines)  
  
---  
  
## Tech Stack  
| Component | Tech |  
|-----------|------|  
| PS Execution | `System.Management.Automation` + `Runspace` |  
| Remote execution | WinRM via `Invoke-Command` equivalent |  
| Parallel jobs | `Task.WhenAll` + `CancellationToken` |  
| Script isolation | Path validation + allowlist |  
  
---  
  
## Detailed Tasks  
  
### 1. Create Script Execution Models  
```csharp  
// src/Nexus.Gateway/Models/ScriptModels.cs  
public enum ScriptLanguage { PowerShell, Python, Batch, VBScript }  
  
public class ScriptRunRequest  
{  
    public string ScriptPath { get; set; } = "";       // Relative to plugin dir  
    public string PluginId { get; set; } = "";         // Plugin that owns the script  
    public ScriptLanguage Language { get; set; } = ScriptLanguage.PowerShell;  
    public List<string> Targets { get; set; } = new(); // Hostnames or group IDs  
    public bool Parallel { get; set; } = false;  
    public int TimeoutSeconds { get; set; } = 60;  
    public Dictionary<string, string> Parameters { get; set; } = new();  
}  
  
public class ScriptResult  
{  
    public string ExecutionId { get; set; } = Guid.NewGuid().ToString();  
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;  
    public DateTime? CompletedAt { get; set; }  
    public List<MachineScriptResult> Results { get; set; } = new();  
    public bool Success => Results.All(r => r.Success);  
}  
  
public class MachineScriptResult  
{  
    public string Hostname { get; set; } = "";  
    public bool Success { get; set; }  
    public string Output { get; set; } = "";  
    public string Error { get; set; } = "";  
    public int ExitCode { get; set; }  
    public TimeSpan Duration { get; set; }  
}  
```  
  
### 2. Create Script Executor  
```csharp  
// src/Nexus.Gateway/Core/ScriptExecutor.cs  
public interface IScriptExecutor  
{  
    Task<ScriptResult> ExecuteAsync(ScriptRunRequest request, CancellationToken ct = default);  
    Task<MachineScriptResult> ExecuteOnMachineAsync(string hostname, string scriptContent, ScriptLanguage lang, int timeoutSeconds, CancellationToken ct);  
}  
  
public class ScriptExecutor : IScriptExecutor  
{  
    // Key behaviors:  
    // 1. Resolve script file path (must be inside plugins/ directory - security check)  
    // 2. Read script content from file  
    // 3. Resolve target machines (expand groups to individual hostnames)  
    // 4. Execute parallel or sequential based on request.Parallel  
    // 5. Collect per-machine results  
    // 6. Write to audit log after completion  
      
    private async Task<MachineScriptResult> RunPowerShellAsync(string hostname, string script, int timeoutSecs, CancellationToken ct)  
    {  
        // Wrap in: 
        // > 🔁 **Scheduler Required**: This operation MUST be submitted via
        // > WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
        // Invoke-Command -ComputerName $hostname -ScriptBlock { ... }  
        // Use WinRmClient for actual transport  
    }  
      
    private async Task<MachineScriptResult> RunPythonAsync(string hostname, string script, int timeoutSecs, CancellationToken ct)  
    {  
        // Copy script to remote machine temp path via WinRM  
        // Execute: python.exe <temppath>  
        // Clean up temp file after  
    }  
      
    private async Task<MachineScriptResult> RunBatchAsync(string hostname, string script, int timeoutSecs, CancellationToken ct)  
    {  
        // Copy .bat to remote temp dir  
        // Execute via cmd.exe  
    }  
      
    private void ValidateScriptPath(string pluginId, string scriptPath)  
    {  
        // SECURITY: Ensure script path resolves inside plugins/<pluginId>/scripts/  
        // Reject any path with .. or absolute paths  
        var resolved = Path.GetFullPath(Path.Combine(pluginsDir, pluginId, scriptPath));  
        if (!resolved.StartsWith(Path.GetFullPath(pluginsDir)))  
            throw new SecurityException("Script path escape attempt blocked");  
    }  
}  
```  
  
### 3. Create Script API Controller  
```csharp  
// src/Nexus.Gateway/Controllers/ScriptsController.cs  
[ApiController]  
[Route("api/scripts")]  
public class ScriptsController : ControllerBase  
{  
    [HttpPost("run")]  
    public async Task<IActionResult> RunScript([FromBody] ScriptRunRequest request)  
    {  
        var result = await scriptExecutor.ExecuteAsync(request);  
        return Ok(result);  
    }  
      
    [HttpGet("languages")]  
    public IActionResult GetSupportedLanguages()  
        => Ok(new[] { "powershell", "python", "batch", "vbscript" });  
}  
```  
  
### 4. Target Resolution Logic  
```csharp  
// In ScriptExecutor — resolve "all", group IDs, and explicit hostnames  
private List<string> ResolveTargets(List<string> targets)  
{  
    // "all" → all machines from MachineConfigLoader  
    // "group:SP-SPSE" → expand group to machine list  
    // "DC01" → use directly  
    // Mix supported: ["DC01", "group:SP-SPSE", "SQL01"]  
}  
```  
  
### 5. Parallel Execution Pattern  
```csharp  
// Parallel execution with controlled concurrency  
var semaphore = new SemaphoreSlim(maxConcurrency, maxConcurrency); // Default: 5 concurrent  
var tasks = targets.Select(async host =>  
{  
    await semaphore.WaitAsync(ct);  
    try { return await ExecuteOnMachineAsync(host, script, lang, timeout, ct); }  
    finally { semaphore.Release(); }  
});  
var results = await Task.WhenAll(tasks);  
```  
  
---  

## Global Data Transfer Objects (DTOs) — Canonical Definitions

These are the authoritative shapes for ALL inter-layer communication in NEXUS.
Backend, Frontend, and Plugins MUST use these contracts. Do not redefine inline.

### Core Execution Contracts

```typescript
// Backend response for any WinRM command execution
interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  machineId: string;
  executedAt: string;           // ISO-8601
  jobId?: string;               // Present if async job was created
}

// Paginated list wrapper
interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}
```

### Machine & Infrastructure Contracts

```typescript
interface MachineRecord {
  id: string;
  hostname: string;
  ipAddress: string;
  role: MachineRole;            // "DC" | "SharePoint" | "SQL" | "AppServer" | "Client"
  farmId?: string;
  winRmEnabled: boolean;
  lastSeenAt: string;
  osVersion: string;
  tags: string[];
}

type MachineRole = "DC" | "SharePoint" | "SQL" | "AppServer" | "Client";
```

### Job System Contracts

```typescript
interface JobRecord {
  id: string;
  machineId: string;
  pluginId: string;
  status: "Queued" | "Running" | "Completed" | "Failed" | "Cancelled" | "TimedOut";
  command: string;
  outputPath?: string;
  errorSummary?: string;
  progressPercent: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface JobSubmitRequest {
  machineId: string;
  pluginId: string;
  command: string;
  timeoutSeconds?: number;      // Default: 300
  notifyOnComplete?: boolean;
}
```

### Alerting Contracts

```typescript
interface AlertEvent {
  id: string;
  metric: string;               // "CPU" | "Memory" | "Disk" | "SPHealth" | "ServiceDown"
  value: number;
  threshold: number;
  machineId: string;
  severity: "Info" | "Warning" | "Critical";
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolved: boolean;
}

interface AlertRule {
  id: string;
  metric: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  severity: AlertEvent["severity"];
  machineIds: string[];         // Empty = applies to all
  enabled: boolean;
  cooldownSeconds: number;      // Prevent alert storms
}
```

### Audit & Compliance Contracts

```typescript
interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userDisplayName: string;
  machine: string;
  pluginId: string;
  action: string;
  status: "Success" | "Failure" | "Partial";
  durationMs: number;
  commandPreview: string;       // First 200 chars of command, no secrets
  ipAddress: string;
}
```

### Credential Vault Contracts

```typescript
interface CredentialEntry {
  id: string;
  label: string;
  username: string;
  targetMachines: string[];     // Machine IDs or ["*"] for all
  createdAt: string;
  updatedAt: string;
  // password field NEVER returned in API responses
}

interface VaultStatus {
  isUnlocked: boolean;
  entryCount: number;
  lastExportAt?: string;
  keyRotatedAt?: string;
}
```

---  
  
## API Endpoints Produced  
  
| Method | Endpoint | Description |  
|--------|----------|-------------|  
| POST | `/api/scripts/run` | Execute script on targets |  
| GET | `/api/scripts/languages` | List supported languages |  
  
**POST /api/scripts/run request body:**  
```json  
{  
  "scriptPath": "scripts/iis-reset.ps1",  
  "pluginId": "iis-manager",  
  "language": "PowerShell",  
  "targets": ["SPSE-WFE01", "SPSE-APP01"],  
  "parallel": true,  
  "timeoutSeconds": 60,  
  "parameters": {}  
}  
```  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Models/ScriptModels.cs` | Create |  
| `src/Nexus.Gateway/Core/ScriptExecutor.cs` | Create |  
| `src/Nexus.Gateway/Controllers/ScriptsController.cs` | Create |  
| `src/Nexus.Gateway/Program.cs` | Modify (add DI) |  
  
---  
  
## Test Criteria  
- [ ] `POST /api/scripts/run` with a simple `Get-ComputerInfo` PS script returns results  
- [ ] Results include per-machine output, success flag, and duration  
- [ ] Parallel execution runs on all targets concurrently  
- [ ] Path escape attempt (e.g., `../../sensitive.ps1`) returns 400 error  
- [ ] Script timeout is respected (60s default kills hung scripts)  
- [ ] Group target `group:SP-SPSE` expands correctly to SPSE-WFE01 + SPSE-APP01  
- [ ] `all` target runs on every defined machine  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **3-0:** Script models + path validation + security sandbox  
- **3-1:** PowerShell executor via WinRM  
- **3-2:** Python / Batch / VBS executors  
- **3-3:** Target resolution (groups + all)  
- **3-4:** Parallel execution + ScriptsController  
  
---  
  
## Notes for Coding Agent  
- CRITICAL: Script path sandboxing must be implemented — never allow arbitrary file execution  
- The executor should never expose the local filesystem path to the client  
- For Python scripts: Python must be installed on TARGET machine, not NEXUS host  
- VBScript execution: `cscript.exe /nologo <script.vbs>`  
- Batch execution: `cmd.exe /c <script.bat>`  
- All execution is REMOTE (on target machines), not local on the NEXUS host  
- Parameters in `ScriptRunRequest.Parameters` should be passed as PS variables: `$param1 = "value"`
