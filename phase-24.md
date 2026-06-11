# Phase 24 — Scheduled Tasks Plugin (Task Scheduler Management)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `scheduled-tasks` plugin — a web-based replacement for the Windows Task Scheduler (`taskschd.msc`). It enables administrators to view, enable, disable, run, and delete scheduled tasks on any managed machine. It provides insights into task triggers, actions, and the last run result (success/failure), making it easy to troubleshoot broken background jobs across the server farm.

---

## Context: What is NEXUS?
Many critical IT processes (backups, cleanup scripts, synchronization jobs) rely on Windows Scheduled Tasks. Diagnosing why a task failed usually requires RDPing into the server and opening Task Scheduler. Phase 24 brings this visibility into NEXUS. By using the `ScheduledTasks` PowerShell module remotely, administrators can quickly identify failing tasks, inspect their triggers, and trigger them manually directly from the browser.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/scheduled-tasks/plugin.json` — plugin manifest
- Sidebar tool: full-page scheduled task manager
- Task List: hierarchical or flat view of tasks (similar to the Windows folder structure `\Microsoft\Windows\...`)
- Filtering: by state (Ready, Running, Disabled), last run result (Success, Error), or task name
- Task Details Drawer: Triggers, Actions, Settings, and Last Run Time/Result
- Task Operations: Enable, Disable, Start (Run), Stop, Delete
- Multi-machine mode: query a specific task path across multiple machines to check status consistency
- PowerShell scripts: `scripts/get-tasks.ps1`, `scripts/manage-tasks.ps1`
- Context menu contribution: "Manage Scheduled Tasks" on machine cards (Phase 15)

**Out of scope:**
- Complex Task Creation GUI (Creating complex tasks with multiple conditions is best done via PowerShell; basic creation might be considered later, but initially focus on monitoring and state management)
- Exporting/Importing XML definitions of tasks (Future enhancement)

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing PowerShell commands remotely)
- Phase 3 (Script Executor — for running the task management scripts)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview — context menu)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Task retrieval & management | PowerShell (`Get-ScheduledTask`, `Start-ScheduledTask`, etc.) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/scheduled-tasks/plugin.json
{
  "id": "scheduled-tasks",
  "name": "Scheduled Tasks",
  "description": "View and manage Windows Scheduled Tasks. Monitor task states, inspect last run results, and manually trigger or disable tasks across managed machines.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "calendar-clock",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [],
    "tools": [
      {
        "id": "tasks",
        "title": "Scheduled Tasks",
        "icon": "calendar-clock",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 10
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "scheduled-tasks.manage",
        "title": "Manage Scheduled Tasks",
        "icon": "calendar-clock",
        "scripts": {},
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "scheduled-tasks.manage"
      }
    ],
    "settings_page": {
      "id": "scheduled-tasks-settings",
      "title": "Scheduled Tasks Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "hide_microsoft_tasks": {
      "type": "boolean",
      "default": true,
      "label": "Hide Microsoft/Windows system tasks by default"
    }
  }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/scheduled-tasks/ui/Tool.tsx
//
// Full-page scheduled task manager.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Scheduled Tasks                                                 │
// │  Target: [DC01 ▼]               [Multi-Machine Mode ☐]         │
// ├──────────────────────────────────────────────────────────────────┤
// │  [Search tasks...]  [State ▼] [Result ▼] [☐ Hide MS Tasks]      │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  Task Name             │ State   │ Last Run Result │ Next Run Time│
// │  ──────────────────────┼─────────┼─────────────────┼──────────────│
// │  \Backup\DailyBackup   │ Ready   │ Success (0x0)   │ 10/13 02:00  │
// │  \Maintenance\Cleanup  │ Running │ Running         │ 10/13 04:00  │
// │  \Custom\SyncJob       │ Disabled│ Error (0x1)     │ N/A          │
// │  ...                                                             │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: \Backup\DailyBackup                                   │
// │  [▶ Run] [■ Stop] [⊘ Disable] [🗑 Delete] [Details ↗]            │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create Task Details Drawer Component

```tsx
// plugins/scheduled-tasks/ui/components/TaskDetails.tsx
//
// Slide-out drawer showing full details for a scheduled task.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   DailyBackup                   │
// ├──────────────────────────────────────────┤
// │  Path:          \Backup\                 │
// │  State:         Ready                    │
// │  Author:        DOMAIN\Administrator     │
// │  Last Run:      10/12/2026 02:00 AM      │
// │  Last Result:   0x0 (Success)            │
// │  Next Run:      10/13/2026 02:00 AM      │
// ├──────────────────────────────────────────┤
// │  Triggers:                               │
// │  - Daily at 2:00 AM                      │
// ├──────────────────────────────────────────┤
// │  Actions:                                │
// │  - Start a program: powershell.exe       │
// │    Args: -File C:\Scripts\Backup.ps1     │
// ├──────────────────────────────────────────┤
// │  Settings:                               │
// │  [X] Allow start if on batteries         │
// │  [X] Stop if runs longer than 3 days     │
// ├──────────────────────────────────────────┤
// │  [▶ Run Task] [⊘ Disable]                │
// └──────────────────────────────────────────┘
```

### 4. Create PowerShell Scripts

```powershell
# plugins/scheduled-tasks/scripts/get-tasks.ps1
# Retrieves scheduled tasks and their Info/State.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [switch]$IncludeMicrosoft
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($incMs)
        
        $tasks = Get-ScheduledTask
        if (-not $incMs) {
            $tasks = $tasks | Where-Object { $_.TaskPath -notmatch "^\\Microsoft\\" }
        }
        
        $output = @()
        foreach ($t in $tasks) {
            $info = Get-ScheduledTaskInfo -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction SilentlyContinue
            
            # Simple Trigger and Action formatting for UI
            $triggerDesc = ($t.Triggers | ForEach-Object { 
                # This is a simplification; actual trigger parsing is complex, but ToString() gives a hint or we map properties
                $_.ToString() 
            }) -join "; "
            
            $actionDesc = ($t.Actions | ForEach-Object { 
                if ($_.Execute) { "$($_.Execute) $($_.Arguments)" } else { $_.ToString() }
            }) -join "; "

            $output += @{
                Name = $t.TaskName
                Path = $t.TaskPath
                State = $t.State.ToString()
                Author = $t.Author
                LastRunTime = if ($info.LastRunTime) { $info.LastRunTime.ToString("o") } else { $null }
                LastTaskResult = if ($null -ne $info.LastTaskResult) { $info.LastTaskResult } else { $null }
                NextRunTime = if ($info.NextRunTime) { $info.NextRunTime.ToString("o") } else { $null }
                Triggers = $triggerDesc
                Actions = $actionDesc
            }
        }
        return $output
    } -ArgumentList $IncludeMicrosoft.IsPresent -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; count = $results.Count; tasks = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/scheduled-tasks/scripts/manage-tasks.ps1
# Handles Start, Stop, Enable, Disable, Delete.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$TaskPath,
    [string]$TaskName,
    [string]$Action # 'start', 'stop', 'enable', 'disable', 'delete'
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($path, $name, $act)
        
        $taskParams = @{ TaskPath = $path; TaskName = $name; ErrorAction = "Stop" }
        
        switch ($act) {
            'start'   { Start-ScheduledTask @taskParams }
            'stop'    { Stop-ScheduledTask @taskParams }
            'enable'  { Enable-ScheduledTask @taskParams | Out-Null }
            'disable' { Disable-ScheduledTask @taskParams | Out-Null }
            'delete'  { Unregister-ScheduledTask @taskParams -Confirm:$false }
            default   { throw "Unknown action: $act" }
        }
    } -ArgumentList $TaskPath, $TaskName, $Action -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; taskName = $TaskName; action = $Action } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; taskName = $TaskName; action = $Action; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 5. Create Plugin README

```markdown
# plugins/scheduled-tasks/README.md

# Scheduled Tasks Plugin

**ID:** `scheduled-tasks`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
View, monitor, and manage Windows Scheduled Tasks. Start, stop, enable, or disable tasks directly from the browser.

## Contributions
- **Sidebar Tool** — "Scheduled Tasks"
- **Context Menu** — "Manage Scheduled Tasks" on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hide_microsoft_tasks`| boolean | true | Hide standard Windows system tasks |

## Scripts
- `scripts/get-tasks.ps1` — Queries Task Scheduler and `Get-ScheduledTaskInfo`
- `scripts/manage-tasks.ps1` — State management (Start/Stop/Enable/Disable/Delete)
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/scheduled-tasks/plugin.json` | Create | Full manifest |
| `plugins/scheduled-tasks/ui/Tool.tsx` | Create | Full tasks page |
| `plugins/scheduled-tasks/ui/components/TaskDetails.tsx`| Create | Drawer for task info |
| `plugins/scheduled-tasks/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/scheduled-tasks/scripts/get-tasks.ps1` | Create | Fetch script |
| `plugins/scheduled-tasks/scripts/manage-tasks.ps1`| Create | Action script |
| `plugins/scheduled-tasks/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page loads and queries tasks from target
- [ ] "Hide MS Tasks" filter toggle works as expected
- [ ] Translates `LastTaskResult` integer (e.g., 0, 1, 267009) into meaningful success/error states
- [ ] Actions (Run, Disable, etc.) correctly invoke the script and update the UI state upon success
- [ ] Details drawer correctly displays trigger and action strings

---

## Sub-Phase Breakdown (if needed)
- **24-0:** Plugin manifest + README + folder structure
- **24-1:** `get-tasks.ps1` and `manage-tasks.ps1` implementations
- **24-2:** UI shell: Tool page and machine selector
- **24-3:** Task data table with filtering logic
- **24-4:** Task Details drawer and action buttons integration
- **24-5:** Settings page and context menu integration

---

## Notes for Coding Agent
- **Performance:** `Get-ScheduledTaskInfo` can be slow if querying thousands of Microsoft default tasks. It is highly recommended to filter tasks (e.g., exclude `\Microsoft\*`) *before* piping them to `Get-ScheduledTaskInfo` to improve load times.
- **Result Codes:** `LastTaskResult` `0` is success. `267009` usually means "The task is currently running" or "completed but still running". Common Win32 error codes might appear here, so consider a utility function in TypeScript to map common codes to text.
- **Triggers/Actions Parsing:** The objects returned by `Get-ScheduledTask` for triggers and actions are complex CIM objects. Extracting the relevant strings for display in PowerShell before sending the JSON payload makes the React frontend much simpler.


