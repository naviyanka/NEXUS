# Phase 23 — Windows Update Plugin (Patch Management)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `windows-update` plugin — a comprehensive patch management tool. It allows administrators to check for available updates, view update history, install updates, and reboot machines if necessary. Crucially, it supports multi-machine operations, allowing a user to push updates to an entire server group (e.g., all Web Front Ends) simultaneously. It replaces the local Windows Update GUI and traditional WSUS management consoles with a modern web interface.

---

## Context: What is NEXUS?
Patch Tuesday is a recurring headache for system administrators. Logging into dozens of servers sequentially to click "Check for Updates" is not scalable. Phase 23 brings patch management into NEXUS. Utilizing PowerShell's PSWindowsUpdate module (or native COM objects if possible, though PSWindowsUpdate is highly preferred for reliability), it queries the Windows Update Agent remotely. It integrates with Phase 3 (Script Executor) to handle long-running patch installations in parallel across multiple machines.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/windows-update/plugin.json` — plugin manifest
- Sidebar tool: patch management dashboard and machine update status
- Dashboard panel: update compliance summary (machines missing critical updates)
- Check for updates: remotely trigger the Windows Update Agent to scan
- Install updates: select specific updates or install all available
- Update history: view successfully/failed installed patches (KBs)
- Reboot management: reboot machines post-update if required
- Multi-machine mode: install a specific KB across a server group simultaneously
- PowerShell scripts: `scripts/check-updates.ps1`, `scripts/install-updates.ps1`, `scripts/get-update-history.ps1`
- Context menu contribution: "Manage Updates" on machine cards (Phase 15)

**Out of scope:**
- WSUS Server Configuration (Approving/declining patches at the WSUS level)
- Linux patching (NEXUS is Windows Server focused)
- Third-party application patching (e.g., Chrome, Java)

---

## Prerequisites
- Phase 3 (Script Executor — required because checking and installing updates are long-running operations that cannot be done synchronously in a single HTTP request)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview — context menu)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Update operations | PowerShell (`PSWindowsUpdate` module or WUA COM object) |
| Long-running tasks| Phase 3 Script Executor (Background Tasks) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Job Execution Model (MANDATORY for long-running operations)

This phase's operations MUST use the async Job system. No synchronous
wait ExecuteAsync() patterns are permitted for operations exceeding 30 seconds.

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/windows-update/plugin.json
{
  "id": "windows-update",
  "name": "Windows Update",
  "description": "Manage Windows Updates across your infrastructure. Check for updates, review missing patches, install updates in bulk, and review update history.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "refresh-ccw",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "update-compliance",
        "title": "Update Compliance",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 300,
        "data_source": ""
      }
    ],
    "tools": [
      {
        "id": "updates",
        "title": "Windows Update",
        "icon": "refresh-ccw",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 9
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "windows-update.check",
        "title": "Check for Updates",
        "icon": "search",
        "scripts": {
          "powershell": "scripts/check-updates.ps1"
        },
        "default_script": "powershell",
        "target": "multi",
        "parallel": true,
        "confirm": false
      },
      {
        "id": "windows-update.install",
        "title": "Install All Updates",
        "icon": "download-cloud",
        "scripts": {
          "powershell": "scripts/install-updates.ps1"
        },
        "default_script": "powershell",
        "target": "multi",
        "parallel": true,
        "confirm": true,
        "confirm_message": "Are you sure you want to install all available updates? This may take significant time and could require a reboot."
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "windows-update.open"
      }
    ],
    "settings_page": {
      "id": "windows-update-settings",
      "title": "Windows Update Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "use_pswindowsupdate": {
      "type": "boolean",
      "default": true,
      "label": "Use PSWindowsUpdate module (recommended)"
    },
    "auto_reboot_default": {
      "type": "boolean",
      "default": false,
      "label": "Default to auto-reboot after install"
    }
  }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/windows-update/ui/Tool.tsx
//
// Full-page patch management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Windows Update                                                  │
// │  Target: [DC01 ▼]               [Multi-Machine Mode ☐]         │
// ├──────────────────────────────────────────────────────────────────┤
// │  [Available Updates] [Update History] [Settings]   ← Tabs        │
// ├──────────────────────────────────────────────────────────────────┤
// │  Last checked: Today, 10:00 AM     [↻ Check for Updates]         │
// │                                                                  │
// │  [X] KB5031362 - 2023-10 Cumulative Update for Windows Server... │
// │      Size: 450 MB | Requires Reboot: Yes | Severity: Critical    │
// │                                                                  │
// │  [X] KB5031408 - .NET Framework 4.8.1 Cumulative Update...       │
// │      Size: 120 MB | Requires Reboot: Yes | Severity: Important   │
// │                                                                  │
// │  [ ] KB890830 - Windows Malicious Software Removal Tool...       │
// │      Size: 35 MB  | Requires Reboot: No  | Severity: Optional    │
// │                                                                  │
// ├──────────────────────────────────────────────────────────────────┤
// │  2 updates selected (570 MB)                                     │
// │  [☐ Auto-reboot if required]                 [⬇ Install Updates]  │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Multi-select list of available updates
// - Tab for update history (past installations)
// - "Check for Updates" triggers a background script task
// - "Install Updates" passes selected KB numbers to the install script
// - Progress polling for installation status
```

### 3. Create Dashboard Panel Component

```tsx
// plugins/windows-update/ui/Panel.tsx
//
// Dashboard widget showing patch compliance across the environment.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Update Compliance                      [Open ↗]     │
// ├──────────────────────────────────────────────────────┤
// │  Farm Status:                                        │
// │  [ 12 ] Up to date                                   │
// │  [  3 ] Missing Critical Updates (⚠)                │
// │  [  1 ] Reboot Pending (↻)                          │
// │                                                      │
// │  Machines Needing Attention:                         │
// │  - SQL01 (Missing 2 Critical)                        │
// │  - SPSE-WFE01 (Reboot Pending)                       │
// └──────────────────────────────────────────────────────┘
```

### 4. Create PowerShell Scripts

```powershell
# plugins/windows-update/scripts/check-updates.ps1
# Scans for available updates using WUA COM Object.

param(
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        $UpdateSession = New-Object -ComObject Microsoft.Update.Session
        $UpdateSearcher = $UpdateSession.CreateUpdateSearcher()
        
        # IsAssigned=1 (WSUS approved) or IsHidden=0 (Not hidden) and IsInstalled=0
        $SearchResult = $UpdateSearcher.Search("IsInstalled=0 and Type='Software' and IsHidden=0")
        
        $updates = @()
        foreach ($update in $SearchResult.Updates) {
            $kbArticles = $update.KBArticleIDs -join ", "
            $updates += @{
                Title = $update.Title
                KB = if ($kbArticles) { "KB$kbArticles" } else { "" }
                SizeMb = [math]::Round($update.MaxDownloadSize / 1MB, 2)
                RequiresReboot = $update.InstallationBehavior.RebootBehavior -gt 0
                IsCritical = $update.MsrcSeverity -eq "Critical"
                Description = $update.Description
            }
        }
        
        # Check if reboot is pending from previous updates
        $sysInfo = New-Object -ComObject "Microsoft.Update.SystemInfo"
        $rebootPending = $sysInfo.RebootRequired
        
        return @{
            updates = $updates
            rebootPending = $rebootPending
            lastSearch = (Get-Date).ToString("o")
        }
    } -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/windows-update/scripts/install-updates.ps1
# Installs specified updates. This is a long-running script.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string[]]$KBsToInstall, # If empty, install all available
    [switch]$AutoReboot
)

# Implementation Note:
# Installing updates via WinRM using the WUA COM object natively is blocked by Windows (WUA API does not allow installation from a remote session for security reasons).
# Workarounds:
# 1. Use Scheduled Tasks to bypass the remote restriction (Create a scheduled task that runs as SYSTEM to install, trigger it, wait for completion).
# 2. Use PSWindowsUpdate module (Invoke-WUJob).
# NEXUS defaults to the Scheduled Task workaround for native compatibility without requiring third-party modules.

try {
    # 1. Generate a local script block to run on the target that does the WUA install
    # 2. Register it as a Scheduled Task on the target machine
    # 3. Start the Scheduled Task
    # 4. Wait for it to complete by polling the task state
    # 5. Retrieve the transcript/log
    
    # (Implementation details of the scheduled task wrapper omitted for brevity, but this is the necessary approach for WinRM + WUA).
    
    @{ success = $true; hostname = $ComputerName; message = "Installation complete. (Mocked for planning phase)" } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 5. Create Plugin README

```markdown
# plugins/windows-update/README.md

# Windows Update Plugin

**ID:** `windows-update`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Manage Windows Updates remotely. Check for available patches, install them across multiple servers simultaneously, and manage pending reboots.

## Contributions
- **Dashboard Panel** — Update compliance summary
- **Sidebar Tool** — "Windows Update" for scanning and installation
- **Context Menu** — "Manage Updates" on machine cards

## Important Technical Note
Installing Windows Updates via standard WinRM sessions is blocked by Windows by default (Exception: `WUA_E_REMOTE_EXCEPTION`). This plugin bypasses this restriction by dynamically creating a temporary Scheduled Task on the target machine, executing it as `SYSTEM`, and monitoring its progress.

## Scripts
- `scripts/check-updates.ps1` — Queries WUA for missing patches
- `scripts/install-updates.ps1` — Handles the Scheduled Task wrapper for installation
- `scripts/get-update-history.ps1` — Retrieves recently installed patches
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/windows-update/plugin.json` | Create | Full manifest |
| `plugins/windows-update/ui/Tool.tsx` | Create | Full update management page |
| `plugins/windows-update/ui/Panel.tsx` | Create | Dashboard compliance panel |
| `plugins/windows-update/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/windows-update/scripts/check-updates.ps1` | Create | Scan script |
| `plugins/windows-update/scripts/install-updates.ps1`| Create | Install script (Scheduled Task wrapper) |
| `plugins/windows-update/scripts/get-update-history.ps1`| Create | History script |
| `plugins/windows-update/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page loads and displays "Check for Updates" button
- [ ] Scanning correctly identifies missing KBs or reports "Up to date"
- [ ] Checks for and correctly identifies if a reboot is pending on the target
- [ ] Installation script successfully bypasses the WinRM WUA restriction using a Scheduled Task
- [ ] Update history accurately reflects patches installed in the last 30 days
- [ ] Multi-machine mode correctly aggregates missing updates across selected servers

---

## Sub-Phase Breakdown (if needed)
- **23-0:** Plugin manifest + README + folder structure
- **23-1:** `check-updates.ps1` and `get-update-history.ps1` implementations
- **23-2:** `install-updates.ps1` implementation (Crucial: implementing the Scheduled Task wrapper)
- **23-3:** UI shell: Tool page and machine selector
- **23-4:** Available Updates list and History list views
- **23-5:** Installation progress monitoring and integration with Phase 3
- **23-6:** Dashboard panel integration

---

## Notes for Coding Agent
- **WUA WinRM Restriction:** This is the most critical hurdle. `Microsoft.Update.Session` allows *searching* via WinRM, but calling `.Download()` or `.Install()` throws a COM Exception. You MUST wrap the install logic in a script block, save it to a `.ps1` on the target, create a Scheduled Task running as `NT AUTHORITY\SYSTEM`, trigger the task, and loop until the task completes.
- **Timeouts:** Patch installation can take 30+ minutes. Ensure the Script Executor request timeout is sufficiently large, or use an async polling mechanism.
- **Reboot Pending:** Querying `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired` or the `Microsoft.Update.SystemInfo` COM object is necessary to warn users before installing more patches.


