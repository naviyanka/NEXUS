# Phase 21 — Process Manager Plugin (Remote Task Manager)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `process-manager` plugin — a remote Task Manager equivalent that allows administrators to view, monitor, and terminate processes on any managed machine. It provides a detailed view of running processes including CPU usage, memory consumption, PID, command-line arguments, and file paths. It supports real-time polling and multi-machine querying to easily locate and kill rogue processes across a server farm.

---

## Context: What is NEXUS?
When a server experiences high CPU or memory pressure (identified via Phase 19 Performance Monitor), administrators need to see exactly which process is the culprit and take action. Phase 21 brings the Task Manager "Details" tab into the browser. It allows you to search for processes by name (e.g., `w3wp.exe`) across multiple machines, inspect their command-line arguments (crucial for distinguishing between multiple Java or Node instances), and safely terminate them. 

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/process-manager/plugin.json` — plugin manifest
- Sidebar tool: full process list with sorting, filtering, and real-time polling
- Dashboard panel: top resource-consuming processes across the farm
- Process querying: get processes via PowerShell/CIM (PID, Name, CPU, RAM, Path, CommandLine, User)
- Multi-machine mode: query a specific process name across all selected machines
- Filtering & Search: by process name, PID, or user
- Action bar: Kill Process (graceful and force), Dump Process (future hook)
- Process detail drawer: threads, handles, modules, command line
- Real-time polling: auto-refresh process list every 5 seconds
- PowerShell scripts: `scripts/get-processes.ps1`, `scripts/kill-process.ps1`
- Context menu contribution: "View Processes" on machine cards (Phase 15)
- Integration with Phase 19: Links from Performance Monitor's process list directly into this plugin

**Out of scope:**
- Modifying process priority or affinity (rarely done via web UI, risks stability)
- Full memory dump analysis (NEXUS can trigger the dump, but analysis is done in WinDbg)
- Linux processes (NEXUS is Windows-only)

---

## Prerequisites
- Phase 2 (WinRM/CIM — required for querying `Win32_Process` to get CommandLine and ExecutablePath, which `Get-Process` alone struggles with for other users' processes without elevation)
- Phase 3 (Script Executor — for running the kill scripts)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview — context menu)
- Phase 19 (Performance Monitor — UI integration)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Process retrieval | PowerShell + CIM (`Win32_Process`, `Get-Process`) |
| Process termination | PowerShell (`Stop-Process`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens (Phase 11) |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/process-manager/plugin.json
{
  "id": "process-manager",
  "name": "Process Manager",
  "description": "View, monitor, and terminate running processes across any managed machine. Includes CPU/RAM usage, command-line arguments, and multi-machine search.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "cpu",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "top-processes",
        "title": "Top Resource Hogs",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 10,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "processes",
        "title": "Process Manager",
        "icon": "cpu",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 7
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "process-manager.kill",
        "title": "Kill Process",
        "icon": "skull",
        "scripts": {
          "powershell": "scripts/kill-process.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": true,
        "confirm_message": "Are you sure you want to terminate this process? Unsaved data may be lost."
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "process-manager.open"
      }
    ],
    "settings_page": {
      "id": "process-manager-settings",
      "title": "Process Manager Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "refresh_interval": {
      "type": "number",
      "default": 5,
      "label": "Auto-refresh interval (seconds)"
    },
    "show_system_processes": {
      "type": "boolean",
      "default": true,
      "label": "Show SYSTEM processes by default"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/process-manager/ui/Panel.tsx
//
// Shows the top 5 CPU and top 5 RAM consuming processes across the selected machine.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Top Resource Hogs (DC01 ▼)             [Open ↗]     │
// ├──────────────────────────────────────────────────────┤
// │  By CPU:                                             │
// │  1. sqlservr.exe   (PID: 1234)   [████████░░] 32%    │
// │  2. w3wp.exe       (PID: 5678)   [███░░░░░░░] 12%    │
// │                                                      │
// │  By Memory:                                          │
// │  1. sqlservr.exe   (PID: 1234)   2,048 MB            │
// │  2. java.exe       (PID: 9012)   1,024 MB            │
// └──────────────────────────────────────────────────────┘
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/process-manager/ui/Tool.tsx
//
// Full-page process management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Process Manager                                                 │
// │  Target: [DC01 ▼]               [Multi-Machine Mode ☐]         │
// ├──────────────────────────────────────────────────────────────────┤
// │  [Search processes...]  [User ▼] [Auto-Refresh: 5s ▼]            │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  Name           │ PID   │ User     │ CPU% │ RAM (MB) │ Threads │
// │  ───────────────┼───────┼──────────┼──────┼──────────┼─────────│
// │  sqlservr.exe   │ 1234  │ MSSQL$.. │ 32.1 │ 2,048    │ 120     │
// │  w3wp.exe       │ 5678  │ IIS APP..│ 12.4 │ 512      │ 45      │
// │  svchost.exe    │ 901   │ SYSTEM   │ 0.1  │ 24       │ 12      │
// │  ...                                                             │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: w3wp.exe (PID: 5678)                                  │
// │  [■ End Task] [Details ↗]                                        │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Sortable columns (Name, PID, User, CPU, RAM)
// - Search filter by Name or PID
// - Auto-refresh toggle
// - Select a row to reveal bottom action bar
// - Double-click row to open detail drawer
```

### 4. Create Process Detail Drawer Component

```tsx
// plugins/process-manager/ui/components/ProcessDetail.tsx
//
// Slide-out drawer showing full details for a single process.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   w3wp.exe (PID: 5678)          │
// ├──────────────────────────────────────────┤
// │  Status:        Running                  │
// │  User:          IIS APPPOOL\DefaultAppP..│
// │  CPU:           12.4%                    │
// │  Memory (WS):   512 MB                   │
// │  Memory (Priv): 400 MB                   │
// │  Threads:       45                       │
// │  Handles:       1,024                    │
// ├──────────────────────────────────────────┤
// │  Command Line:                           │
// │  c:\windows\system32\inetsrv\w3wp.exe -a │
// │  \\.\pipe\iisipm1e041300-2f96-...        │
// ├──────────────────────────────────────────┤
// │  Executable Path:                        │
// │  c:\windows\system32\inetsrv\w3wp.exe    │
// ├──────────────────────────────────────────┤
// │  [■ End Task] [■ Force Kill]             │
// └──────────────────────────────────────────┘
```

### 5. Create PowerShell Scripts

```powershell
# plugins/process-manager/scripts/get-processes.ps1
# Retrieves all processes with detailed WMI info (Command line, path, user)

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$ProcessName = ""
)

try {
    # We use Get-CimInstance Win32_Process to get CommandLine and ExecutablePath.
    # We use Get-Process to get reliable CPU/RAM/Threads/Handles.
    # Merging them provides the best of both worlds.
    
    $filter = if ($ProcessName) { "Name LIKE '%$ProcessName%'" } else { "" }
    
    $cimProcs = Get-CimInstance -ClassName Win32_Process -ComputerName $ComputerName -Filter $filter -ErrorAction Stop
    $psProcs = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock { Get-Process -ErrorAction SilentlyContinue }
    
    $results = @()
    
    foreach ($cp in $cimProcs) {
        $pp = $psProcs | Where-Object { $_.Id -eq $cp.ProcessId }
        
        $cpu = if ($pp) { [math]::Round($pp.CPU, 1) } else { 0 }
        $ram = if ($pp) { [math]::Round($pp.WorkingSet64 / 1MB, 2) } else { 0 }
        
        # GetOwner is an invoked method in CIM
        # Optimization: only fetch owner if specifically requested, or batch it. 
        # For a full list, fetching owner for 100+ processes is slow. 
        # We will omit owner in the bulk query unless it's a single detail query.
        
        $results += @{
            pid = $cp.ProcessId
            name = $cp.Name
            cpuSeconds = $cpu
            ramMb = $ram
            path = $cp.ExecutablePath
            commandLine = $cp.CommandLine
            threads = $cp.ThreadCount
            handles = $cp.HandleCount
            sessionId = $cp.SessionId
        }
    }
    
    @{ success = $true; hostname = $ComputerName; count = $results.Count; processes = $results } | ConvertTo-Json -Depth 3
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/process-manager/scripts/kill-process.ps1
# Terminates a process by PID

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [int]$PIDToKill,
    [switch]$Force
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($targetPid, $forceKill)
        if ($forceKill) {
            Stop-Process -Id $targetPid -Force -ErrorAction Stop
        } else {
            Stop-Process -Id $targetPid -ErrorAction Stop
        }
    } -ArgumentList $PIDToKill, $Force.IsPresent

    @{ success = $true; hostname = $ComputerName; pid = $PIDToKill; action = "killed" } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; pid = $PIDToKill; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 6. Create Plugin README

```markdown
# plugins/process-manager/README.md

# Process Manager Plugin

**ID:** `process-manager`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
View and manage running processes across managed machines. Supports process termination, resource usage monitoring, and inspecting command-line arguments.

## Contributions
- **Dashboard Panel** — Top CPU and RAM consuming processes
- **Sidebar Tool** — "Process Manager" for full list and control
- **Context Menu** — "View Processes" on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `refresh_interval` | number | 5 | Auto-refresh interval (seconds) |
| `show_system_processes`| boolean| true | Show SYSTEM processes by default |

## Scripts
- `scripts/get-processes.ps1` — Retrieves merged CIM/Get-Process data
- `scripts/kill-process.ps1` — Terminates a process by PID
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/process-manager/plugin.json` | Create | Full manifest |
| `plugins/process-manager/ui/Panel.tsx` | Create | Dashboard panel |
| `plugins/process-manager/ui/Tool.tsx` | Create | Full process manager page |
| `plugins/process-manager/ui/components/ProcessDetail.tsx` | Create | Drawer for process details |
| `plugins/process-manager/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/process-manager/scripts/get-processes.ps1` | Create | Fetch script |
| `plugins/process-manager/scripts/kill-process.ps1` | Create | Kill script |
| `plugins/process-manager/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page loads and fetches process list from selected machine
- [ ] Sorting by CPU and RAM correctly updates the list
- [ ] Auto-refresh ticks every 5 seconds without resetting table scroll state
- [ ] Search input filters processes instantly by name or PID
- [ ] Clicking a process opens the detail drawer with CommandLine info
- [ ] Killing a non-critical test process (e.g., notepad.exe) succeeds and removes it from the list
- [ ] Dashboard panel accurately reflects top 5 resource consumers

---

## Sub-Phase Breakdown (if needed)
- **21-0:** Plugin manifest + README + folder structure
- **21-1:** `get-processes.ps1` and `kill-process.ps1` script implementation
- **21-2:** UI shell: Tool page and machine selector
- **21-3:** Process data table with sorting and local filtering
- **21-4:** Process details drawer and Kill action integration
- **21-5:** Dashboard panel integration
- **21-6:** Auto-Refresh logic and integration with Phase 19

---

## Notes for Coding Agent
- **Merging Data:** PowerShell's `Get-Process` gives accurate CPU/RAM but lacks `CommandLine`. `Win32_Process` gives `CommandLine` but calculating CPU% from it is notoriously complex. The script merges them by matching PID.
- **Performance:** Polling `Win32_Process` for 200+ processes every 5 seconds can be heavy. Use `> 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command` to do the heavy lifting remotely and only return the serialized JSON payload.
- **State Management:** When the table auto-refreshes, ensure the currently selected row (if any) remains selected based on PID, and that the scroll position doesn't jump.
- **Permissions:** Getting process details for other users (like SYSTEM) requires the WinRM connection to have Administrator rights, which NEXUS requires by default.


