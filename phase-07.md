# Phase 7 — WebSocket Engine (SignalR: Terminal + Live Metrics)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Implement real-time bidirectional communication using SignalR. Two hubs: `TerminalHub` for interactive remote shell sessions (xterm.js in browser ↔ PowerShell on target machine) and `MetricsHub` for pushing live CPU/RAM/disk updates to the dashboard without polling.  
  
---  
  
## Context  
NEXUS's remote terminal feature requires a persistent WebSocket connection: keystrokes go from browser → NEXUS backend → WinRM → PowerShell on target machine, and output comes back the same way in real-time. The metrics hub allows the dashboard to show live sparklines that update every few seconds without the frontend polling REST endpoints.  
  
---  
  
## Scope  
**In scope:**  
- `TerminalHub.cs` — SignalR hub for interactive terminal sessions  
- `MetricsHub.cs` — SignalR hub for broadcasting machine metrics  
- Terminal session lifecycle: open, input, resize, close  
- Live metrics broadcast: push updates every 5 seconds to subscribed clients  
- Connection management: track which clients are watching which machines  
- Terminal session model and session store  
  
**Out of scope:**  
- xterm.js frontend component (Phase 16)  
- Frontend charts (Phase 19)  
- The `data/` or `logs/` writing from terminal sessions (Phase 15 audit log)  
  
---  
  
## Prerequisites  
- Phase 1 (service running + SignalR configured)  
- Phase 2 (WinRM client)  
  
---  
  
## Tech Stack  
| Component | Tech |  
|-----------|------|  
| WebSocket | `Microsoft.AspNetCore.SignalR` |  
| PS streaming | `Runspace` with output pipeline |  
| Session store | `ConcurrentDictionary` in-memory |  
  
---  
  
## TerminalHub  
  
```csharp  
// src/Nexus.Gateway/Hubs/TerminalHub.cs  
public class TerminalHub : Hub  
{  
    // Client calls:  
    // - OpenTerminal(hostname, credentialId) → assigns sessionId, starts PS runspace  
    // - SendInput(sessionId, data) → writes to PS runspace stdin  
    // - ResizeTerminal(sessionId, cols, rows) → resizes PTY  
    // - CloseTerminal(sessionId) → disposes runspace  
      
    // Server sends:  
    // - TerminalOutput(sessionId, data) → raw terminal output bytes/string  
    // - TerminalClosed(sessionId, reason) → connection ended  
    // - TerminalError(sessionId, error) → connection failed  
      
    public async Task OpenTerminal(string hostname, string credentialId)  
    {  
        var sessionId = Guid.NewGuid().ToString();  
        // Create WinRM/PS runspace for this machine  
        // Store in TerminalSessionStore  
        // Begin streaming output back to this connection  
        await Clients.Caller.SendAsync("TerminalReady", sessionId);  
    }  
      
    public async Task SendInput(string sessionId, string data)  
    {  
        // Write data to the PS pipeline for this session  
        var session = sessionStore.Get(sessionId);  
        session?.WriteInput(data);  
    }  
}  
```  
  
## MetricsHub  
  
```csharp  
// src/Nexus.Gateway/Hubs/MetricsHub.cs  
public class MetricsHub : Hub  
{  
    // Client calls:  
    // - SubscribeToMachine(hostname) → starts receiving metrics for this machine  
    // - SubscribeToAll() → receives metrics for all machines  
    // - Unsubscribe(hostname)  
      
    // Server broadcasts:  
    // - MachineMetrics(MetricsPayload) → CPU%, RAM%, Disk%, timestamp  
      
    // Background timer pushes metrics every 5 seconds to subscribed clients  
}  
  
public class MetricsPayload  
{  
    public string Hostname { get; set; }  
    public double CpuPercent { get; set; }  
    public double RamPercent { get; set; }  
    public long RamFreeMb { get; set; }  
    public double DiskPercent { get; set; }  
    public DateTime Timestamp { get; set; }  
    public bool IsOnline { get; set; }  
}  
```  
  
## Terminal Session Store  
  
```csharp  
// src/Nexus.Gateway/Core/TerminalSessionStore.cs  
public class TerminalSession  
{  
    public string SessionId { get; set; }  
    public string Hostname { get; set; }  
    public string ConnectionId { get; set; }  // SignalR connection ID  
    public DateTime StartedAt { get; set; }  
    public bool IsActive { get; set; }  
    // Runspace reference for PS execution  
}  
```  
  
## Register in Program.cs  
  
```csharp  
app.MapHub<TerminalHub>("/hubs/terminal");  
app.MapHub<MetricsHub>("/hubs/metrics");  
```  
  
---  
  
## API Endpoints + WebSocket Routes  
  
| Type | Route | Purpose |  
|------|-------|---------|  
| WS | `/hubs/terminal` | Interactive terminal sessions |  
| WS | `/hubs/metrics` | Live machine metrics broadcast |  
| GET | `/api/terminals` | List active terminal sessions |  
| DELETE | `/api/terminals/{sessionId}` | Force-close a session |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Hubs/TerminalHub.cs` | Create |  
| `src/Nexus.Gateway/Hubs/MetricsHub.cs` | Create |  
| `src/Nexus.Gateway/Core/TerminalSessionStore.cs` | Create |  
| `src/Nexus.Gateway/Core/MetricsBroadcaster.cs` | Create |  
| `src/Nexus.Gateway/Program.cs` | Modify (MapHub) |  
  
---  
  
## Test Criteria  
- [ ] SignalR client can connect to `/hubs/terminal` without error  
- [ ] `OpenTerminal("DC01", "domain-admin")` returns sessionId  
- [ ] Input sent via `SendInput` appears as PowerShell command output  
- [ ] Terminal output streams back character-by-character in real-time  
- [ ] `CloseTerminal` properly disposes the PS runspace  
- [ ] MetricsHub pushes updates every 5 seconds to subscribed clients  
- [ ] Disconnecting client (browser close) cleans up the terminal session  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **7-0:** SignalR setup + hub registration in Program.cs  
- **7-1:** TerminalHub + TerminalSessionStore  
- **7-2:** PS runspace streaming (real-time output pipeline)  
- **7-3:** MetricsHub + MetricsBroadcaster background service  
- **7-4:** Terminal session API endpoints + cleanup  
  
---  
  
## Notes for Coding Agent  
- Terminal output must be streamed as it's produced — do NOT buffer and send all at once  
- Handle terminal session cleanup when SignalR connection drops (use `OnDisconnectedAsync`)  
- PS runspace for terminal needs to be interactive — not `> 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command` but an actual runspace  
- MetricsBroadcaster should reuse the CIM client from Phase 2, not create new connections  
- WebSocket connection requires authentication — check JWT in SignalR connection context  
- Limit concurrent terminal sessions per user (config: max 5 by default)

