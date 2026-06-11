# Phase 17 — Service Manager Plugin (Windows Services CRUD)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `service-manager` plugin — a full Windows services management tool that replicates and extends Windows Admin Center's service manager. Administrators can view all services on any machine, start/stop/restart services, change startup types, view service dependencies, and perform bulk service operations across multiple machines. Uses CIM/WMI for service queries and WinRM for service control commands. This is the third WAC-parity plugin and one of the most-used daily operations tools for IT administrators.

---

## Context: What is NEXUS?
Windows services are the heartbeat of every server. Administrators spend significant time checking service states, restarting stuck services, and verifying startup configurations across machines. Phase 2 built the WinRM/CIM engine that queries remote machines. Phase 17 wraps service management into a plugin with a rich UI — replacing the need to RDP into each machine and open `services.msc`. NEXUS adds multi-machine capabilities that WAC lacks: restart the same service across an entire SharePoint farm in one click.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/service-manager/plugin.json` — plugin manifest
- Dashboard panel: service health summary (critical service status across machines)
- Sidebar tool: full service list with filtering, sorting, and service control
- Service CRUD: start, stop, restart, pause, resume, change startup type
- Multi-machine service operations: restart a service across selected machines
- Service detail view: description, dependencies, dependent services, account, PID
- Real-time status via CIM polling (auto-refresh)
- Service search and filter: by name, status (running/stopped/paused), startup type
- Context menu contribution: "Manage Services" on machine cards
- PowerShell scripts: `scripts/get-services.ps1`, `scripts/control-service.ps1`, `scripts/get-service-detail.ps1`
- Critical service monitoring: highlight key services (DNS, ADDS, SQL, IIS, SPTimerV4, etc.)
- Service log: recent start/stop events from Windows Event Log for each service

**Out of scope:**
- Service creation/deletion (rarely needed, use PowerShell directly)
- Service binary path editing (security risk)
- Service permission/ACL editing (Phase 33 security plugins)
- Linux/systemd service management (NEXUS is Windows-only)

---

## Prerequisites
- Phase 2 (WinRM/CIM — for querying `Win32_Service` and executing service control)
- Phase 3 (Script Executor — for running service management scripts)
- Phase 12 (Plugin Renderer — loads Panel and Tool components)
- Phase 13 (Dashboard Grid — hosts the service health panel)
- Phase 14 (Machine Management — machine list, group selection for multi-machine ops)
- Phase 15 (Machine Overview — context menu integration)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Service queries | CIM: `Win32_Service` class via WinRM (Phase 2) |
| Service control | PowerShell: `Start-Service`, `Stop-Service`, `Restart-Service`, `Set-Service` |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens (Phase 11) |
| Scripts | PowerShell 5.1+ |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/service-manager/plugin.json
{
  "id": "service-manager",
  "name": "Service Manager",
  "description": "View, start, stop, restart, and configure Windows services on any managed machine. Supports multi-machine operations for farm-wide service control.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "cog",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "service-health",
        "title": "Service Health",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 30,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "services",
        "title": "Service Manager",
        "icon": "cog",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 4
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "service-manager.restart-service",
        "title": "Restart Service",
        "icon": "refresh-cw",
        "scripts": {
          "powershell": "scripts/control-service.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": true,
        "confirm_message": "Are you sure you want to restart this service?"
      },
      {
        "id": "service-manager.stop-service",
        "title": "Stop Service",
        "icon": "square",
        "scripts": {
          "powershell": "scripts/control-service.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": true,
        "confirm_message": "Stopping this service may affect dependent services. Continue?"
      },
      {
        "id": "service-manager.restart-across-machines",
        "title": "Restart Service on Multiple Machines",
        "icon": "refresh-cw",
        "scripts": {
          "powershell": "scripts/control-service.ps1"
        },
        "default_script": "powershell",
        "target": "multi",
        "parallel": true,
        "confirm": true,
        "confirm_message": "Restart this service across all selected machines?"
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "service-manager.restart-service"
      },
      {
        "location": "dashboard_toolbar",
        "command": "service-manager.restart-across-machines"
      }
    ],
    "settings_page": {
      "id": "service-manager-settings",
      "title": "Service Manager Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },

  "config_schema": {
    "refresh_interval": {
      "type": "number",
      "default": 30,
      "label": "Auto-refresh interval (seconds)"
    },
    "critical_services": {
      "type": "string",
      "default": "DNS,NTDS,ADWS,W3SVC,SPTimerV4,MSSQLSERVER,WinRM,EventLog",
      "label": "Critical service names (comma-separated)"
    },
    "show_microsoft_services": {
      "type": "boolean",
      "default": true,
      "label": "Show Microsoft system services"
    },
    "default_view": {
      "type": "string",
      "default": "all",
      "label": "Default filter (all | running | stopped | critical)"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/service-manager/ui/Panel.tsx
//
// Dashboard panel showing critical service health across all machines.
// Default size: 6 columns wide, 4 rows tall.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Service Health                         [↻ Refresh]  │
// │  12 Critical Services Monitored · 2 Issues           │
// ├──────────────────────────────────────────────────────┤
// │                                                      │
// │  DC01                                                │
// │  ● DNS  ● NTDS  ● ADWS  ● Kerberos  ● EventLog     │
// │                                                      │
// │  SQL01                                               │
// │  ● MSSQLSERVER  ● SQLSERVERAGENT  ○ SSIS ⚠          │
// │                                                      │
// │  SPSE-WFE01                                          │
// │  ● W3SVC  ● SPTimerV4  ● IISAdmin  ● WAS            │
// │                                                      │
// │  SPSE-APP01                                          │
// │  ● SPTimerV4  ● SPSearchHostCtrl  ○ AppFabric ⚠     │
// │                                                      │
// └──────────────────────────────────────────────────────┘
//
// Features:
// - Groups critical services by machine
// - Status dots: green (running), red (stopped), yellow (paused/degraded)
// - Only shows services from `critical_services` config list
// - Stopped critical services highlighted with ⚠ warning icon
// - Click a service → navigate to Tool view filtered to that service
// - Click a machine name → navigate to Tool view for that machine
// - Auto-refresh on configured interval
// - Summary line: total critical monitored, count of issues
// - Offline machines shown with grey "Machine Offline" placeholder

interface PanelProps {
  context: NexusPluginContext;
}
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/service-manager/ui/Tool.tsx
//
// Full-page service management tool.
// Sidebar: System → Service Manager
// Route: /plugins/service-manager/services
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Service Manager                                                 │
// │  Machine: [DC01 ▼]              [Multi-Machine Mode ☐]         │
// ├──────────────────────────────────────────────────────────────────┤
// │  [Search services...]  [Status ▼] [Startup ▼] [★ Critical]    │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  Name              │ Display Name            │ Status  │ Startup │
// │  ─────────────────┼────────────────────────┼─────────┼─────────│
// │  ADWS             │ Active Dir. Web Svc    │ ● Run   │ Auto    │
// │  CryptSvc         │ Cryptographic Services │ ● Run   │ Auto    │
// │  DNS              │ DNS Server             │ ● Run   │ Auto    │
// │  EventLog         │ Windows Event Log      │ ● Run   │ Auto    │
// │  MSSQLSERVER      │ SQL Server (MSSQL)     │ ● Run   │ Auto    │
// │  Spooler          │ Print Spooler          │ ○ Stop  │ Manual  │
// │  W3SVC            │ World Wide Web Pub Svc │ ● Run   │ Auto    │
// │  WinRM            │ Windows Remote Mgmt    │ ● Run   │ Auto    │
// │  ...                                                            │
// │                                                                  │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: Spooler — Print Spooler                              │
// │  [▶ Start] [■ Stop] [↻ Restart] [⏸ Pause]  Startup: [Auto ▼] │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Machine selector dropdown at top (single machine mode)
// - Multi-machine toggle: select multiple machines, see service comparison
// - Service table with sortable columns
// - Search: real-time filter by service name or display name
// - Status filter: All / Running / Stopped / Paused
// - Startup type filter: All / Automatic / Manual / Disabled
// - Critical services filter toggle (★ star icon)
// - Click service row → select it, show action bar at bottom
// - Action bar: Start, Stop, Restart, Pause, Resume, Change Startup Type
// - Double-click row → open service detail drawer
// - Multi-select: Shift+Click or Ctrl+Click for bulk service actions
// - Auto-refresh on interval (configurable)
// - Color-coded status column: green=running, red=stopped, yellow=paused

interface ToolProps {
  context: NexusPluginContext;
}

// State:
// - selectedMachine: string (hostname)
// - multiMachineMode: boolean
// - selectedMachines: string[] (for multi-machine mode)
// - services: ServiceInfo[] (from CIM query)
// - selectedServices: string[] (service names)
// - searchQuery: string
// - statusFilter: 'all' | 'running' | 'stopped' | 'paused'
// - startupFilter: 'all' | 'automatic' | 'manual' | 'disabled'
// - criticalOnly: boolean
// - isLoading: boolean
// - sortField: 'name' | 'displayName' | 'status' | 'startupType'
// - sortDirection: 'asc' | 'desc'
```

### 4. Create Service Detail Drawer Component

```tsx
// plugins/service-manager/ui/components/ServiceDetail.tsx
//
// Slide-out drawer showing full details for a single service.
// Opens on double-click or "Details" button from service table.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   DNS Server                    │
// │            dns (Win32_Service)            │
// ├──────────────────────────────────────────┤
// │  Status:        ● Running                │
// │  Startup Type:  Automatic                │
// │  PID:           1284                     │
// │  Account:       NT AUTHORITY\NETWORK SVC │
// │  Path:          C:\Windows\System32\...  │
// ├──────────────────────────────────────────┤
// │  Description:                            │
// │  The DNS Server service enables DNS      │
// │  name resolution by answering...         │
// ├──────────────────────────────────────────┤
// │  Dependencies (requires):                │
// │    ● Afd           (Running)             │
// │    ● RpcSs         (Running)             │
// │    ● Tcpip         (Running)             │
// │                                          │
// │  Dependent Services (required by):       │
// │    ● DnsCache      (Running)             │
// ├──────────────────────────────────────────┤
// │  Recent Events (last 10):                │
// │  12:34:05  Service started               │
// │  12:30:01  Service stopped               │
// │  08:00:00  Service started               │
// ├──────────────────────────────────────────┤
// │  [▶ Start] [■ Stop] [↻ Restart]         │
// │  Startup: [Automatic ▼] [Apply]         │
// └──────────────────────────────────────────┘
//
// Data sourced from:
// - Win32_Service: Name, DisplayName, State, StartMode, ProcessId, StartName, PathName, Description
// - Win32_DependentService: Dependencies and dependent services
// - Win32_NTLogEvent: Recent service start/stop events (System log, EventID 7036)
//
// Props:
// - hostname: string
// - serviceName: string
// - onClose: () => void
// - context: NexusPluginContext
```

### 5. Create Multi-Machine Service View Component

```tsx
// plugins/service-manager/ui/components/MultiMachineView.tsx
//
// Shows a specific service's status across multiple machines.
// Activated when "Multi-Machine Mode" is toggled in the Tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────┐
// │  Service: [W3SVC ▼]         Machines: [SP-SPSE ▼] [All ▼] │
// ├──────────────────────────────────────────────────────────────┤
// │                                                              │
// │  Machine         │ Status  │ PID    │ Startup │ Action      │
// │  ────────────────┼─────────┼────────┼─────────┼─────────── │
// │  SPSE-WFE01      │ ● Run   │ 4120   │ Auto    │ [↻] [■]   │
// │  SPSE-APP01      │ ● Run   │ 3890   │ Auto    │ [↻] [■]   │
// │  SP2019-WFE01    │ ○ Stop  │ —      │ Auto    │ [▶] [↻]   │
// │  SP2019-APP01    │ ● Run   │ 5012   │ Auto    │ [↻] [■]   │
// │                                                              │
// ├──────────────────────────────────────────────────────────────┤
// │  [↻ Restart All] [▶ Start Stopped] [■ Stop All]             │
// └──────────────────────────────────────────────────────────────┘
//
// Features:
// - Service name dropdown: pick which service to compare across machines
// - Machine filter: by group or "All"
// - Table showing the same service on each machine
// - Per-machine action buttons for individual control
// - Bulk actions: Restart All, Start Stopped, Stop All
// - Parallel execution for bulk operations (via Script Executor Phase 3)
// - Color-coded rows: green=running, red=stopped, yellow=inconsistent
// - "Inconsistent" badge if service status varies across farm
//
// Props:
// - selectedService: string
// - machines: string[]
// - context: NexusPluginContext
```

### 6. Create Service Action Bar Component

```tsx
// plugins/service-manager/ui/components/ServiceActionBar.tsx
//
// Fixed bottom bar showing actions for selected service(s).
// Appears when one or more services are selected in the table.
//
// Layout (single service selected):
// ┌──────────────────────────────────────────────────────────────────┐
// │  Selected: DNS — DNS Server (Running)                            │
// │  [▶ Start] [■ Stop] [↻ Restart] [⏸ Pause]  Startup: [Auto ▼]  │
// └──────────────────────────────────────────────────────────────────┘
//
// Layout (multiple services selected):
// ┌──────────────────────────────────────────────────────────────────┐
// │  3 services selected                                             │
// │  [▶ Start All] [■ Stop All] [↻ Restart All]  [✕ Clear]         │
// └──────────────────────────────────────────────────────────────────┘
//
// Behaviors:
// - Buttons are contextual: "Start" disabled if already running, etc.
// - Confirmation dialog for Stop and Restart actions
// - Startup type dropdown: Automatic / Manual / Disabled + [Apply] button
// - Executing action shows spinner on button, success/error toast
// - Multi-select: only common actions shown (Start All, Stop All, Restart All)
// - Keyboard shortcuts: Enter = Restart (most common), Delete = Stop
//
// Props:
// - selectedServices: ServiceInfo[]
// - hostname: string
// - onAction: (action: ServiceAction, serviceNames: string[]) => void
// - isExecuting: boolean
```

### 7. Create Service TypeScript Types

```typescript
// plugins/service-manager/ui/types.ts

/** Service information from Win32_Service CIM query */
export interface ServiceInfo {
  name: string;               // Internal service name (e.g., "DNS")
  displayName: string;        // Display name (e.g., "DNS Server")
  status: ServiceStatus;      // Running | Stopped | Paused | StartPending | StopPending
  startupType: StartupType;   // Automatic | Manual | Disabled
  processId: number | null;   // PID if running, null if stopped
  account: string;            // Service account (e.g., "NT AUTHORITY\NETWORK SERVICE")
  path: string;               // Binary path
  description: string;        // Service description
  isCritical: boolean;        // Matched against critical_services config
}

export type ServiceStatus =
  | 'Running'
  | 'Stopped'
  | 'Paused'
  | 'StartPending'
  | 'StopPending'
  | 'ContinuePending'
  | 'PausePending';

export type StartupType = 'Automatic' | 'Manual' | 'Disabled' | 'DelayedAutomatic';

export type ServiceAction = 'start' | 'stop' | 'restart' | 'pause' | 'resume' | 'setStartup';

/** Service dependency information */
export interface ServiceDependency {
  name: string;
  displayName: string;
  status: ServiceStatus;
}

/** Service event from Windows Event Log */
export interface ServiceEvent {
  timestamp: string;         // ISO 8601
  eventId: number;           // 7036 = state change, 7045 = installed
  message: string;           // Event message
  level: 'Information' | 'Warning' | 'Error';
}

/** Full service detail (for detail drawer) */
export interface ServiceDetail extends ServiceInfo {
  dependencies: ServiceDependency[];
  dependentServices: ServiceDependency[];
  recentEvents: ServiceEvent[];
}

/** Result of a service control action */
export interface ServiceActionResult {
  hostname: string;
  serviceName: string;
  action: ServiceAction;
  success: boolean;
  previousStatus: ServiceStatus;
  newStatus: ServiceStatus;
  error?: string;
  durationMs: number;
}

/** Multi-machine service comparison row */
export interface CrossMachineServiceRow {
  hostname: string;
  displayName: string;
  status: ServiceStatus;
  startupType: StartupType;
  processId: number | null;
  isOnline: boolean;         // Machine reachability
}
```

### 8. Create Settings Page Component

```tsx
// plugins/service-manager/ui/Settings.tsx
//
// Plugin settings for service-manager.
// Accessible via: Settings → Service Manager Settings
//
// Fields (from config_schema):
// - Refresh interval: number input (10–300 seconds, default 30)
// - Critical services: textarea with comma-separated service names
//   Pre-populated: DNS, NTDS, ADWS, W3SVC, SPTimerV4, MSSQLSERVER, WinRM, EventLog
//   Helper text: "These services are highlighted in the dashboard panel and can be filtered in the tool view"
// - Show Microsoft services: toggle (default true)
//   When false, hides OS-level services (svchost, csrss, etc.) for cleaner view
// - Default view: dropdown (all | running | stopped | critical)
//
// Additional options (not in config_schema, stored locally):
// - Custom critical services per machine group (e.g., IIS services only for SP machines)
// - Service name aliases for readability

interface SettingsProps {
  context: NexusPluginContext;
}
```

### 9. Create PowerShell Scripts

```powershell
# plugins/service-manager/scripts/get-services.ps1
# Retrieves all Windows services from a target machine with extended info.
# Target: single machine
# Returns: JSON array of service objects

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME,

    [Parameter(Mandatory=$false)]
    [string]$Filter = ""   # Optional: filter by name pattern
)

try {
    $services = Get-CimInstance -ClassName Win32_Service -ComputerName $ComputerName |
        Where-Object { 
            if ($Filter) { $_.Name -like "*$Filter*" -or $_.DisplayName -like "*$Filter*" }
            else { $true }
        } |
        Select-Object @{N='name';E={$_.Name}},
                      @{N='displayName';E={$_.DisplayName}},
                      @{N='status';E={$_.State}},
                      @{N='startupType';E={
                          switch ($_.StartMode) {
                              'Auto'     { if ($_.DelayedAutoStart) { 'DelayedAutomatic' } else { 'Automatic' } }
                              'Manual'   { 'Manual' }
                              'Disabled' { 'Disabled' }
                              default    { $_.StartMode }
                          }
                      }},
                      @{N='processId';E={ if ($_.ProcessId -gt 0) { $_.ProcessId } else { $null } }},
                      @{N='account';E={$_.StartName}},
                      @{N='path';E={$_.PathName}},
                      @{N='description';E={$_.Description}}

    @{
        success  = $true
        hostname = $ComputerName
        count    = $services.Count
        services = @($services)
    } | ConvertTo-Json -Depth 3
}
catch {
    @{
        success  = $false
        hostname = $ComputerName
        error    = $_.Exception.Message
    } | ConvertTo-Json -Depth 3
}
```

```powershell
# plugins/service-manager/scripts/control-service.ps1
# Controls a Windows service: start, stop, restart, pause, resume, set startup type.
# Target: single machine
# Parameters: ServiceName, Action, StartupType (optional)

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME,

    [Parameter(Mandatory=$true)]
    [string]$ServiceName,

    [Parameter(Mandatory=$true)]
    [ValidateSet('start', 'stop', 'restart', 'pause', 'resume', 'setStartup')]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [ValidateSet('Automatic', 'Manual', 'Disabled')]
    [string]$StartupType = ""
)

try {
    $svc = Get-Service -Name $ServiceName -ComputerName $ComputerName -ErrorAction Stop
    $previousStatus = $svc.Status.ToString()

    switch ($Action) {
        'start' {
            Start-Service -InputObject $svc -ErrorAction Stop
            $svc.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
        }
        'stop' {
            Stop-Service -InputObject $svc -Force -ErrorAction Stop
            $svc.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
        }
        'restart' {
            Restart-Service -InputObject $svc -Force -ErrorAction Stop
            $svc.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
        }
        'pause' {
            Suspend-Service -InputObject $svc -ErrorAction Stop
            $svc.WaitForStatus('Paused', [TimeSpan]::FromSeconds(30))
        }
        'resume' {
            Resume-Service -InputObject $svc -ErrorAction Stop
            $svc.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
        }
        'setStartup' {
            if (-not $StartupType) { throw "StartupType parameter required for setStartup action" }
            Set-Service -InputObject $svc -StartupType $StartupType -ErrorAction Stop
        }
    }

    $svc.Refresh()

    @{
        success        = $true
        hostname       = $ComputerName
        serviceName    = $ServiceName
        action         = $Action
        previousStatus = $previousStatus
        newStatus      = $svc.Status.ToString()
    } | ConvertTo-Json
}
catch {
    @{
        success        = $false
        hostname       = $ComputerName
        serviceName    = $ServiceName
        action         = $Action
        error          = $_.Exception.Message
        errorType      = $_.Exception.GetType().Name
    } | ConvertTo-Json
}
```

```powershell
# plugins/service-manager/scripts/get-service-detail.ps1
# Retrieves detailed service information including dependencies and recent events.
# Target: single machine
# Returns: JSON with full service detail, dependency tree, and recent events

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceName,

    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    # Service basic info
    $svc = Get-CimInstance -ClassName Win32_Service -ComputerName $ComputerName -Filter "Name='$ServiceName'"
    if (-not $svc) { throw "Service '$ServiceName' not found on $ComputerName" }

    # Dependencies (services this service requires)
    $deps = Get-CimInstance -ClassName Win32_DependentService -ComputerName $ComputerName |
        Where-Object { $_.Dependent.Name -eq $ServiceName } |
        ForEach-Object {
            $depSvc = Get-Service -Name $_.Antecedent.Name -ComputerName $ComputerName -ErrorAction SilentlyContinue
            @{
                name        = $_.Antecedent.Name
                displayName = if ($depSvc) { $depSvc.DisplayName } else { $_.Antecedent.Name }
                status      = if ($depSvc) { $depSvc.Status.ToString() } else { 'Unknown' }
            }
        }

    # Dependent services (services that require this service)
    $dependents = Get-CimInstance -ClassName Win32_DependentService -ComputerName $ComputerName |
        Where-Object { $_.Antecedent.Name -eq $ServiceName } |
        ForEach-Object {
            $depSvc = Get-Service -Name $_.Dependent.Name -ComputerName $ComputerName -ErrorAction SilentlyContinue
            @{
                name        = $_.Dependent.Name
                displayName = if ($depSvc) { $depSvc.DisplayName } else { $_.Dependent.Name }
                status      = if ($depSvc) { $depSvc.Status.ToString() } else { 'Unknown' }
            }
        }

    # Recent events from System log (EventID 7036 = service state change)
    $events = Get-WinEvent -ComputerName $ComputerName -FilterHashtable @{
        LogName   = 'System'
        Id        = 7036
        StartTime = (Get-Date).AddDays(-7)
    } -MaxEvents 50 -ErrorAction SilentlyContinue |
        Where-Object { $_.Message -like "*$($svc.DisplayName)*" } |
        Select-Object -First 10 |
        ForEach-Object {
            @{
                timestamp = $_.TimeCreated.ToString("o")
                eventId   = $_.Id
                message   = $_.Message
                level     = $_.LevelDisplayName
            }
        }

    @{
        success           = $true
        hostname          = $ComputerName
        name              = $svc.Name
        displayName       = $svc.DisplayName
        status            = $svc.State
        startupType       = $svc.StartMode
        processId         = if ($svc.ProcessId -gt 0) { $svc.ProcessId } else { $null }
        account           = $svc.StartName
        path              = $svc.PathName
        description       = $svc.Description
        dependencies      = @($deps)
        dependentServices = @($dependents)
        recentEvents      = @($events)
    } | ConvertTo-Json -Depth 4
}
catch {
    @{
        success     = $false
        hostname    = $ComputerName
        serviceName = $ServiceName
        error       = $_.Exception.Message
    } | ConvertTo-Json -Depth 3
}
```

### 10. Create Plugin README

```markdown
# plugins/service-manager/README.md

# Service Manager Plugin

**ID:** `service-manager`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Full Windows service management for any managed machine. View all services,
start/stop/restart, change startup types, view dependencies, and perform
multi-machine service operations across an entire farm.

## Contributions
- **Dashboard Panel** — Service health summary showing critical services across all machines
- **Sidebar Tool** — "Service Manager" with full service table, filtering, and control
- **Commands** — "Restart Service", "Stop Service", "Restart Service on Multiple Machines"
- **Context Menu** — "Restart Service" on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `refresh_interval` | number | 30 | Seconds between auto-refresh |
| `critical_services` | string | DNS,NTDS,ADWS,... | Comma-separated critical service names |
| `show_microsoft_services` | boolean | true | Show OS-level system services |
| `default_view` | string | all | Default filter: all, running, stopped, critical |

## Scripts
- `scripts/get-services.ps1` — Lists all services with status, startup type, and details
- `scripts/control-service.ps1` — Start, stop, restart, pause, resume, or change startup type
- `scripts/get-service-detail.ps1` — Full detail including dependencies and recent events

## Key Features
- **Multi-Machine Mode**: Compare a specific service across multiple machines (e.g., W3SVC on all SharePoint servers)
- **Critical Services**: Configurable list of services highlighted in dashboard and filterable in tool
- **Dependency Tree**: View which services depend on a service before stopping it
- **Service Events**: Recent start/stop events from Windows Event Log
- **Bulk Actions**: Start/Stop/Restart multiple services at once

## Dependencies
- Phase 2: WinRM/CIM (Win32_Service queries)
- Phase 3: Script Executor (service control scripts)
- Phase 14: Machine Management (machine list)
- Phase 15: Machine Overview (context menu)
```

---

## API Endpoints Consumed

This plugin does NOT produce new REST API endpoints. It uses Script Executor (Phase 3) and CIM queries (Phase 2):

| Type | Route / Method | Source Phase | Usage |
|------|---------------|-------------|-------|
| POST | `/api/scripts/run` | Phase 3 | Execute service control scripts |
| GET | `/api/machines` | Phase 14 | Machine list for selector |
| GET | `/api/machines/groups` | Phase 14 | Machine groups for multi-machine filtering |
| GET | `/api/plugins/service-manager` | Phase 6 | Read plugin config |

**CIM Queries Used (via WinRM, Phase 2):**

| CIM Class | Properties | Purpose |
|-----------|-----------|---------|
| `Win32_Service` | Name, DisplayName, State, StartMode, ProcessId, StartName, PathName, Description | Service list and detail |
| `Win32_DependentService` | Antecedent, Dependent | Dependency tree |

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/service-manager/plugin.json` | Create | Full manifest |
| `plugins/service-manager/ui/Panel.tsx` | Create | Dashboard panel — critical service health |
| `plugins/service-manager/ui/Tool.tsx` | Create | Sidebar tool — full service management |
| `plugins/service-manager/ui/Settings.tsx` | Create | Plugin settings page |
| `plugins/service-manager/ui/types.ts` | Create | ServiceInfo, ServiceDetail, etc. |
| `plugins/service-manager/ui/components/ServiceDetail.tsx` | Create | Service detail slide-out drawer |
| `plugins/service-manager/ui/components/MultiMachineView.tsx` | Create | Cross-machine service comparison |
| `plugins/service-manager/ui/components/ServiceActionBar.tsx` | Create | Bottom action bar for service control |
| `plugins/service-manager/scripts/get-services.ps1` | Create | Service list query |
| `plugins/service-manager/scripts/control-service.ps1` | Create | Service control (start/stop/restart/etc.) |
| `plugins/service-manager/scripts/get-service-detail.ps1` | Create | Full service detail with deps + events |
| `plugins/service-manager/README.md` | Create | Plugin documentation |

---

## Integration Points

- **Phase 2 (WinRM/CIM):** All service data is queried via CIM `Win32_Service` through the WinRM connection pool. Service queries use `Get-CimInstance` which flows through the Phase 2 `CimClient`.
- **Phase 3 (Script Executor):** Service control actions (start/stop/restart/set startup) are executed via `POST /api/scripts/run` using the plugin's PowerShell scripts. The executor handles target resolution and parallel execution for multi-machine operations.
- **Phase 12 (Plugin Renderer):** `Panel.tsx` rendered in dashboard grid, `Tool.tsx` rendered at sidebar route. Both receive `NexusPluginContext`.
- **Phase 13 (Dashboard Grid):** Service Health panel occupies default position (6 cols, 4 rows). Users can move/resize.
- **Phase 14 (Machine Management):** Machine selector dropdown populated from `GET /api/machines`. Group filtering for multi-machine mode uses `GET /api/machines/groups`.
- **Phase 15 (Machine Overview):** Context menu items ("Restart Service") appear on machine cards when this plugin is loaded.

---

## Test Criteria
- [ ] `plugins/service-manager/plugin.json` validates as valid JSON matching Phase 6 schema
- [ ] Plugin appears in `GET /api/plugins` and sidebar shows "Service Manager" under System
- [ ] Dashboard panel shows critical services grouped by machine with correct status dots
- [ ] Stopped critical services show ⚠ warning indicator in dashboard panel
- [ ] Tool view shows all services from selected machine in sortable table
- [ ] Search filters services by name and display name in real-time
- [ ] Status filter correctly shows only Running / Stopped / Paused services
- [ ] "★ Critical" toggle shows only services in the critical_services config list
- [ ] Clicking "Start" on a stopped service starts it, status updates to "Running"
- [ ] Clicking "Stop" on a running service shows confirmation, then stops it
- [ ] Clicking "Restart" restarts the service (status briefly shows pending, then running)
- [ ] Changing startup type from "Automatic" to "Disabled" persists after refresh
- [ ] Double-clicking a service row opens the detail drawer with description and dependencies
- [ ] Dependency tree shows correct service relationships (e.g., DNS depends on RpcSs, Tcpip)
- [ ] Recent events section shows last 10 service state changes from Event Log
- [ ] Multi-machine mode: selecting W3SVC shows its status across all SharePoint servers
- [ ] Multi-machine "Restart All" restarts the service on every selected machine in parallel
- [ ] Multi-select services (Ctrl+Click): bulk "Stop All" stops all selected services
- [ ] Context menu on machine card shows "Restart Service" option
- [ ] Service control on offline machine shows appropriate error message
- [ ] Auto-refresh updates service list on configured interval (default 30s)
- [ ] All components use CSS variable theme tokens (no hardcoded colors)
- [ ] `npm run build` includes plugin components without errors

---

## Sub-Phase Breakdown (if needed)
- **17-0:** `plugin.json` manifest + `README.md` + plugin folder structure + types
- **17-1:** `get-services.ps1` script + test on real machine
- **17-2:** Tool view base — machine selector + service table + sorting
- **17-3:** Service filtering (search, status, startup, critical toggle)
- **17-4:** `control-service.ps1` script + `ServiceActionBar.tsx` — service start/stop/restart
- **17-5:** `ServiceDetail.tsx` — detail drawer with description, deps, events
- **17-6:** `get-service-detail.ps1` script — dependencies + event log query
- **17-7:** `MultiMachineView.tsx` — cross-machine service comparison + bulk actions
- **17-8:** Dashboard Panel (`Panel.tsx`) — critical service health summary
- **17-9:** Settings page + auto-refresh + context menu integration + polish

---

## Notes for Coding Agent
- CIM query for services: use `Get-CimInstance -ClassName Win32_Service -ComputerName $hostname` NOT `Get-WmiObject` (deprecated). The CIM query flows through Phase 2's WinRM connection pool.
- Service control uses `Start-Service`, `Stop-Service`, etc. with `-ComputerName` parameter. These use WinRM under the hood. The `WaitForStatus()` call ensures the action completes before returning.
- `Restart-Service` with `-Force` flag is essential — it stops dependent services first, then restarts. Without `-Force`, restart fails if dependent services are running.
- `Win32_DependentService` CIM class has `Antecedent` (service that is depended upon) and `Dependent` (service that depends). The naming is confusing — test carefully.
- Service events: `Get-WinEvent` with `EventID 7036` in the System log captures "service entered the running/stopped state" messages. Filter by service display name in the message text.
- Startup type "Delayed Automatic" is reported as `StartMode = 'Auto'` with `DelayedAutoStart = True` on the CIM object. Handle this distinction in the script.
- Multi-machine operations should use the Script Executor (Phase 3) with `parallel: true` to restart a service across 6 machines simultaneously. Respect the concurrency limit (default 5).
- The "critical services" config should be customizable per deployment. The default list covers common Windows Server + SharePoint + SQL services. Administrators add their own service names.
- Service names are case-insensitive on Windows. Use case-insensitive comparison throughout.
- For the dashboard panel, only query critical services (not all 200+ services per machine) to keep polling lightweight. Use CIM filter: `WHERE Name IN ('DNS','NTDS',...)`.
- The detail drawer dependency tree can be recursive (A depends on B depends on C). Limit depth to 3 levels to avoid performance issues.
- Service PID display: link to Process Manager plugin (Phase 21) if loaded. Show "View Process" button that navigates to the process detail.
- Offline machines in dashboard panel: show grey placeholder with last known service states (if cached) or "Machine Offline" text.
- Action buttons should be contextual: hide "Start" for running services, hide "Stop" for stopped services, always show "Restart" for running services.
- Error handling for service control: common errors are "Access denied" (insufficient permissions), "Service did not respond to the start or control request in a timely fashion" (stuck service), and "Cannot stop service because it has dependent services" (need `-Force`).

