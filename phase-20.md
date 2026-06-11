# Phase 20 — Event Viewer Plugin (Centralized Log Analysis)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `event-viewer` plugin — a centralized Windows Event Log viewer that allows administrators to query, filter, and analyze logs across any managed machine. This replaces the slow MMC snap-in with a fast, modern web interface. It includes multi-machine log aggregation, allowing admins to search for a specific error across a whole farm of servers simultaneously. It supports standard logs (Application, System, Security) and custom application logs.

---

## Context: What is NEXUS?
Troubleshooting Windows Server issues invariably requires reading Event Logs. Doing this via RDP + `eventvwr.msc` is slow, especially when tracing an issue across multiple load-balanced web servers. Phase 20 brings Event Logs into NEXUS. By using `Get-WinEvent` via PowerShell remoting (Phase 3) or CIM (Phase 2), NEXUS can pull thousands of events quickly. The frontend uses a virtualized list to handle massive log volumes smoothly, providing instant filtering and search.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/event-viewer/plugin.json` — plugin manifest
- Sidebar tool: full event log viewer page
- Dashboard panel: recent critical/error events summary
- Log querying: Application, System, Security, Setup, and custom logs
- Multi-machine aggregation: query logs from multiple machines into a single chronological view
- Filtering: by Level (Error, Warning, Info), Event ID, Source, Time range
- Search: full-text search within event messages
- Virtualized list: handle 10,000+ events in the browser without lagging
- Live tailing: auto-refresh option to fetch new events every X seconds
- Event detail view: full XML/text details of an event
- PowerShell script: `scripts/get-event-logs.ps1`
- Context menu contribution: "View Event Logs" on machine cards

**Out of scope:**
- Forwarding/Syslog integration (NEXUS queries on-demand, it is not a SIEM)
- Modifying/Clearing event logs (read-only for safety)
- Creating custom event logs/sources

---

## Prerequisites
- Phase 2 (WinRM/CIM) or Phase 3 (Script Executor — `Get-WinEvent` is usually faster via PS remoting than CIM for large sets)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview — context menu)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Log retrieval | PowerShell: `Get-WinEvent` (via Phase 3 Script Executor) |
| Large lists | `react-window` or `@tanstack/react-virtual` for DOM virtualization |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens (Phase 11) |
| Scripts | PowerShell 5.1+ |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/event-viewer/plugin.json
{
  "id": "event-viewer",
  "name": "Event Viewer",
  "description": "Query and analyze Windows Event Logs across one or multiple machines. Features fast filtering, search, and multi-machine log aggregation.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "list-tree",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "recent-errors",
        "title": "Recent Event Errors",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 60,
        "data_source": ""
      }
    ],
    "tools": [
      {
        "id": "viewer",
        "title": "Event Viewer",
        "icon": "list-tree",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 6
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "event-viewer.open",
        "title": "View Event Logs",
        "icon": "list-tree",
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
        "command": "event-viewer.open"
      }
    ],
    "settings_page": {
      "id": "event-viewer-settings",
      "title": "Event Viewer Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },

  "config_schema": {
    "default_log": {
      "type": "string",
      "default": "System",
      "label": "Default log to open"
    },
    "max_events": {
      "type": "number",
      "default": 1000,
      "label": "Maximum events to fetch per query"
    },
    "default_time_range": {
      "type": "number",
      "default": 24,
      "label": "Default time range (hours)"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/event-viewer/ui/Panel.tsx
//
// Shows a feed of recent Error/Critical events from the System/Application logs.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Recent Errors (Last 24h)               [Open ↗]     │
// ├──────────────────────────────────────────────────────┤
// │  [DC01 ▼]                                            │
// │                                                      │
// │  [X] System     10:05:22 AM  (Service Control Mgr)   │
// │      The Spooler service terminated unexpectedly.    │
// │                                                      │
// │  [!] Application 09:12:00 AM  (Application Error)    │
// │      Faulting application name: w3wp.exe...          │
// │                                                      │
// │  [X] System      08:00:01 AM  (Disk)                 │
// │      The device, \Device\Harddisk1\DR1, has a bad... │
// └──────────────────────────────────────────────────────┘
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/event-viewer/ui/Tool.tsx
//
// Main event viewer interface.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Event Viewer                                                    │
// │  Target: [DC01, SQL01 ▼]  Log: [System ▼]  Range: [Last 24h ▼] │
// │  [Search message...]  [Level: Error, Warning ▼] [Source ▼] [ID]  │
// │  [Fetch Events] [Auto-Refresh: Off]                              │
// ├──────────────────────────────────────────────────────────────────┤
// │  Level │ Date and Time      │ Source        │ Event ID │ Machine │
// │  ──────┼────────────────────┼───────────────┼──────────┼──────── │
// │  [X]   │ 10/10/26 10:05:22  │ Service C...  │ 7034     │ DC01    │
// │  [!]   │ 10/10/26 09:15:00  │ Microsoft-... │ 10016    │ DC01    │
// │  [i]   │ 10/10/26 09:14:00  │ Service C...  │ 7036     │ SQL01   │
// │  ... (virtualized list)                                          │
// ├──────────────────────────────────────────────────────────────────┤
// │  Event 7034, Service Control Manager                             │
// │  ──────────────────────────────────────────────────────────────  │
// │  The Print Spooler service terminated unexpectedly. It has done  │
// │  this 1 time(s). The following corrective action will be taken   │
// │  in 60000 milliseconds: Restart the service.                     │
// │                                                                  │
// │  [XML View] [Copy]                                               │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Multi-machine support: merges logs from multiple machines chronologically
// - Virtualized table using react-window for high performance
// - Split pane: list on top, details on bottom (resizable)
```

### 4. Create PowerShell Script

```powershell
# plugins/event-viewer/scripts/get-event-logs.ps1
# Retrieves event logs based on criteria.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$LogName = "System",
    [int]$Hours = 24,
    [int]$MaxEvents = 1000,
    [string[]]$Levels = @("1","2","3","4"), # 1=Critical, 2=Error, 3=Warning, 4=Info
    [string]$Source = "",
    [string]$EventId = ""
)

try {
    $startTime = (Get-Date).AddHours(-$Hours)
    
    $filterHash = @{
        LogName = $LogName
        StartTime = $startTime
    }
    
    if ($Levels.Count -gt 0 -and $Levels.Count -lt 4) {
        $filterHash.Level = $Levels
    }
    
    if ($Source) { $filterHash.ProviderName = "*$Source*" } # Note: Get-WinEvent ProviderName doesn't strictly support wildcards in hash, might need Where-Object or XML filter for complex source filtering, but sticking to basic for now. Actually, let's just use Where-Object for provider/id if needed to keep it simple, or build an XML filter. For reliability, basic FilterHashtable + Where-Object if needed.
    
    # Building exact FilterHashtable is faster
    if ($EventId) { $filterHash.Id = $EventId }
    if ($Source) { $filterHash.ProviderName = $Source }

    $events = Get-WinEvent -ComputerName $ComputerName -FilterHashtable $filterHash -MaxEvents $MaxEvents -ErrorAction Stop |
        Select-Object @{N='Machine';E={$_.MachineName}},
                      @{N='TimeCreated';E={$_.TimeCreated.ToString("o")}},
                      @{N='Id';E={$_.Id}},
                      @{N='Level';E={$_.LevelDisplayName}},
                      @{N='LevelId';E={$_.Level}},
                      @{N='Provider';E={$_.ProviderName}},
                      @{N='Message';E={$_.Message}},
                      @{N='LogName';E={$_.LogName}}

    @{ success = $true; hostname = $ComputerName; events = @($events) } | ConvertTo-Json -Depth 3
}
catch {
    # Handle "No events found" gracefully as it throws an error in Get-WinEvent
    if ($_.Exception.Message -match "No events were found") {
        @{ success = $true; hostname = $ComputerName; events = @() } | ConvertTo-Json
    } else {
        @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
    }
}
```

### 5. Create Plugin README

```markdown
# plugins/event-viewer/README.md

# Event Viewer Plugin

**ID:** `event-viewer`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Centralized Windows Event Log viewer. Replaces `eventvwr.msc` with a fast, modern web interface. Supports multi-machine log aggregation.

## Contributions
- **Dashboard Panel** — Recent critical/error events summary
- **Sidebar Tool** — "Event Viewer" for deep log analysis
- **Context Menu** — "View Event Logs" on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `default_log` | string | System | Default log to open |
| `max_events` | number | 1000 | Max events per query |
| `default_time_range` | number | 24 | Default time range (hours) |
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/event-viewer/plugin.json` | Create | Full manifest |
| `plugins/event-viewer/ui/Panel.tsx` | Create | Dashboard panel |
| `plugins/event-viewer/ui/Tool.tsx` | Create | Full viewer page |
| `plugins/event-viewer/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/event-viewer/scripts/get-event-logs.ps1` | Create | Fetch events script |
| `plugins/event-viewer/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page loads and fetches System log by default
- [ ] Filtering by Level (Error/Warning) works
- [ ] Multi-machine mode correctly queries 2+ machines and sorts chronologically
- [ ] Virtualized list handles 1000+ events smoothly
- [ ] Clicking an event shows full details in the bottom pane
- [ ] Search input filters the retrieved list locally

---

## Sub-Phase Breakdown (if needed)
- **20-0:** Plugin manifest + README + folder structure
- **20-1:** `get-event-logs.ps1` script implementation
- **20-2:** UI shell: Tool page, machine selector, and log selector
- **20-3:** Virtualized list component (`react-window`)
- **20-4:** Event details pane component
- **20-5:** Dashboard panel integration
- **20-6:** Filtering, Search, and Auto-Refresh logic

---

## Notes for Coding Agent
- Use `Get-WinEvent` instead of `Get-EventLog` as the latter is deprecated and slower.
- Multi-machine log aggregation requires parsing timestamps carefully to merge events from different systems chronologically.
- A virtualized list (like `react-window`) is MANDATORY. Attempting to render 10,000 DOM nodes for event logs will crash the browser.
- Consider caching/batching for auto-refresh to prevent overwhelming the target machines.
- XML view should prettify the `EventData` section from the event details.

