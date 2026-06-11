# Phase 15 — Machine Overview Plugin (Dashboard Panel + Sidebar Tool)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the first real plugin: `machine-overview`. This is the P1-Core dashboard panel that gives administrators an at-a-glance view of every machine in the environment — status, health, grouping, and quick actions. It contributes a full-width dashboard panel (12-column), a sidebar tool view for detailed machine monitoring, and a toolbar widget showing the online/total machine count. This is the reference implementation for all future plugins.

---

## Context: What is NEXUS?
NEXUS manages domain machines without agents. Phase 14 built the machine management backend (SQLite CRUD) and frontend (MachinesPage, detail panels, groups). Phase 15 wraps machine visibility into a **plugin** that follows the drop-a-folder architecture. The plugin contributes a dashboard panel (the primary view admins see on `/`), a sidebar tool, and a toolbar widget — all loaded dynamically via the Plugin Renderer (Phase 12) and displayed on the Dashboard Grid (Phase 13). This plugin is also the template other plugin authors will study.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/machine-overview/plugin.json` — full plugin manifest
- Dashboard panel: machine grid showing all machines with status dots, CPU/RAM sparklines, group badges
- Sidebar tool: expanded machine list with filtering, sorting, and inline actions
- Toolbar widget: compact "5/9 Online" badge in the topbar
- Context menu contributions: "Ping", "Open Terminal", "View Details" on machine cards
- Real-time updates via SignalR `MetricsHub` subscription
- Panel auto-refresh on configurable interval (default 30s)
- Responsive layout: cards collapse on narrow panels
- Plugin scripts: `scripts/ping-all.ps1`, `scripts/get-system-info.ps1`

**Out of scope:**
- Machine CRUD operations (Phase 14 — MachinesPage handles this)
- Remote terminal session (Phase 16 — separate plugin)
- Individual service/process management (Phases 17, 21)
- Detailed performance graphs (Phase 19)

---

## Prerequisites
- Phase 6 (Plugin Loader — discovers and loads `plugin.json`)
- Phase 7 (SignalR — `MetricsHub` for live metrics streaming)
- Phase 12 (Plugin Renderer — renders Panel, Tool, Widget components dynamically)
- Phase 13 (Dashboard Grid — hosts the dashboard panel at default position)
- Phase 14 (Machine & Group Management — provides `/api/machines` and `/api/machines/groups` APIs)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Panel/Tool/Widget | React 18 + TypeScript (loaded via Phase 12 dynamic import) |
| Data source | `/api/machines` + `/api/machines/groups` (Phase 14) |
| Real-time | SignalR `MetricsHub` (Phase 7) |
| Icons | `lucide-react` |
| Charts | `recharts` (mini sparklines for CPU/RAM history) |
| Styling | Tailwind CSS + CSS variable theme tokens (Phase 11) |
| Scripts | PowerShell 5.1+ |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/machine-overview/plugin.json
{
  "id": "machine-overview",
  "name": "Machine Overview",
  "description": "At-a-glance view of all machines in the environment with real-time status, health indicators, and quick actions.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "monitor",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "machine-grid",
        "title": "Machine Overview",
        "component": "ui/Panel",
        "size": { "w": 12, "h": 5 },
        "resizable": true,
        "refresh_interval": 30,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "machine-monitor",
        "title": "Machine Monitor",
        "icon": "monitor",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 1
      }
    ],
    "widgets": [
      {
        "id": "online-count",
        "title": "Machine Status",
        "position": "toolbar_right",
        "component": "ui/Widget"
      }
    ],
    "commands": [
      {
        "id": "machine-overview.ping-all",
        "title": "Ping All Machines",
        "icon": "radio",
        "scripts": {
          "powershell": "scripts/ping-all.ps1"
        },
        "default_script": "powershell",
        "target": "all",
        "parallel": true,
        "confirm": false
      },
      {
        "id": "machine-overview.get-system-info",
        "title": "Get System Info",
        "icon": "info",
        "scripts": {
          "powershell": "scripts/get-system-info.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      }
    ],
    "menus": [
      {
        "location": "dashboard_toolbar",
        "command": "machine-overview.ping-all"
      },
      {
        "location": "machine_context_menu",
        "command": "machine-overview.get-system-info"
      }
    ],
    "settings_page": {
      "id": "machine-overview-settings",
      "title": "Machine Overview Settings",
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
    "show_offline": {
      "type": "boolean",
      "default": true,
      "label": "Show offline machines in panel"
    },
    "sparkline_history": {
      "type": "number",
      "default": 20,
      "label": "Sparkline data points to display"
    },
    "compact_mode": {
      "type": "boolean",
      "default": false,
      "label": "Use compact card layout"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/machine-overview/ui/Panel.tsx
//
// Full-width dashboard panel showing all machines in a responsive grid.
// This is the primary view admins see on the "/" dashboard page.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Machine Overview                   [Ping All] [↻ Refresh] [⚙] │
// │  5/9 Online  ·  3 Groups  ·  Last updated: 12:34:05            │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  ┌── SharePoint SE (#00ff9f) ─────────────────────────────────┐ │
// │  │ ┌─────────┐ ┌─────────┐                                   │ │
// │  │ │SPSE-WFE │ │SPSE-APP │                                   │ │
// │  │ │● Online │ │● Online │                                   │ │
// │  │ │CPU ▁▃▅▇ │ │CPU ▁▂▃▂ │                                   │ │
// │  │ │RAM 68%  │ │RAM 45%  │                                   │ │
// │  │ └─────────┘ └─────────┘                                   │ │
// │  └────────────────────────────────────────────────────────────┘ │
// │                                                                  │
// │  ┌── Standalone ──────────────────────────────────────────────┐ │
// │  │ ┌─────────┐ ┌─────────┐ ┌─────────┐                      │ │
// │  │ │  DC01   │ │  SQL01  │ │  WIN11  │                      │ │
// │  │ │● Online │ │● Online │ │○ Offline│                      │ │
// │  │ │CPU ▃▅▇▅ │ │CPU ▁▁▂▁ │ │         │                      │ │
// │  │ │RAM 72%  │ │RAM 34%  │ │         │                      │ │
// │  │ └─────────┘ └─────────┘ └─────────┘                      │ │
// │  └────────────────────────────────────────────────────────────┘ │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Groups machines by MachineGroup with colored group headers
// - Each machine card shows: icon, hostname, status dot, CPU sparkline, RAM bar
// - Offline machines show greyed-out card with last-seen timestamp
// - Click machine card → navigate to /machines/{hostname} (Phase 14 detail page)
// - Right-click → context menu with "Ping", "Get System Info", "Open Terminal"
// - Auto-refresh based on plugin config (default 30s)
// - Subscribes to MetricsHub for live sparkline updates between refreshes
// - Responsive: cards wrap on narrow panels, compact mode available

interface PanelProps {
  context: NexusPluginContext;   // Provided by Phase 12 PluginRenderer
}

// State:
// - machines: MachineDetail[] (from context.api.get('/api/machines'))
// - groups: MachineGroupDetail[] (from context.api.get('/api/machines/groups'))
// - metricsHistory: Map<string, MetricsSnapshot[]> (rolling sparkline data)
// - lastRefresh: Date
// - isRefreshing: boolean

// Uses: recharts <Sparkline> for CPU history mini-chart
// Uses: StatusBadge, MetricsBar from Phase 14 shared components
// Uses: useMachineMetrics hook for SignalR subscription
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/machine-overview/ui/Tool.tsx
//
// Sidebar tool view — expanded machine monitoring page.
// Accessible via sidebar: System → Machine Monitor
// Route: /plugins/machine-overview/machine-monitor
//
// Layout:
// ┌──────────────────────────────────────────────────────────────┐
// │  Machine Monitor                                             │
// │  [Search...] [Status ▼] [Group ▼] [Sort ▼] [Grid|List]     │
// ├──────────────────────────────────────────────────────────────┤
// │                                                              │
// │  ┌─────────────────────────────────────────────────────────┐│
// │  │  DC01 — Domain Controller                         ● Online ││
// │  │  OS: Windows Server 2022  │  Uptime: 14d 3h              ││
// │  │  CPU [████████░░░░░░] 52%  │  RAM [██████████░░] 68%     ││
// │  │  Tags: [dc] [dns] [adds]   │  Group: Domain Controllers  ││
// │  │  [Ping] [Terminal] [Details] [System Info]               ││
// │  └─────────────────────────────────────────────────────────┘│
// │                                                              │
// │  ┌─────────────────────────────────────────────────────────┐│
// │  │  SQL01 — SQL Server                               ● Online ││
// │  │  OS: Windows Server 2022  │  Uptime: 14d 3h              ││
// │  │  CPU [██░░░░░░░░░░░░] 12%  │  RAM [████░░░░░░░░] 34%    ││
// │  │  Tags: [sql] [database]    │  Group: —                   ││
// │  │  [Ping] [Terminal] [Details] [System Info]               ││
// │  └─────────────────────────────────────────────────────────┘│
// │  ...                                                         │
// └──────────────────────────────────────────────────────────────┘
//
// Features:
// - Larger, more detailed machine cards than the dashboard panel
// - Full search/filter/sort controls (reuses SearchFilterBar from Phase 14)
// - Inline action buttons per machine
// - Live metrics via SignalR (same subscription as panel)
// - Grid view (cards) or List view (rows) toggle
// - No group header organization — flat list with group column
// - Click "Details" → navigates to /machines/{hostname}
// - Click "Terminal" → navigates to terminal plugin (Phase 16, if loaded)

interface ToolProps {
  context: NexusPluginContext;
}
```

### 4. Create Toolbar Widget Component

```tsx
// plugins/machine-overview/ui/Widget.tsx
//
// Compact toolbar widget showing machine online count.
// Rendered in the topbar right area by Phase 12 PluginRenderer.
//
// Display: "5/9 Online" with a colored indicator
//   - All online: green accent
//   - Some offline: yellow/warning
//   - All offline: red/danger
//
// Click → navigates to /machines (Phase 14 machines page)
// Hover → tooltip showing per-group counts
//
// Subscribes to MetricsHub for live count updates
// Auto-updates without full page refresh

interface WidgetProps {
  context: NexusPluginContext;
}

// State:
// - totalMachines: number
// - onlineMachines: number
// - groups: { id: string, label: string, online: number, total: number }[]
```

### 5. Create Settings Page Component

```tsx
// plugins/machine-overview/ui/Settings.tsx
//
// Plugin settings page for machine-overview.
// Accessible via: Settings → Machine Overview Settings
//
// Fields (from config_schema in plugin.json):
// - Refresh interval (number input, seconds, default 30)
// - Show offline machines (toggle, default true)
// - Sparkline data points (number input, default 20)
// - Compact mode (toggle, default false)
//
// Settings are persisted via the plugin config system
// (GET/PUT /api/plugins/machine-overview/config)
//
// Uses standard form controls styled with theme tokens

interface SettingsProps {
  context: NexusPluginContext;
}
```

### 6. Create Machine Mini-Card Component

```tsx
// plugins/machine-overview/ui/components/MiniCard.tsx
//
// Compact machine card used inside the dashboard panel.
// Smaller than MachineCard (Phase 14) — optimized for grid density.
//
// Layout:
// ┌──────────────┐
// │  🖥️  DC01    ● │   ← icon + hostname + status dot
// │  CPU ▁▃▅▇▅▃  │   ← sparkline (recharts)
// │  RAM ████░░ 68% │  ← progress bar
// │  [dc] [dns]   │   ← tags (max 3, overflow: +N)
// └──────────────┘
//
// Props:
// - machine: MachineDetail
// - metricsHistory: MetricsSnapshot[] (for sparkline)
// - compact: boolean (even smaller layout)
// - onClick: (hostname: string) => void
// - onContextMenu: (e: React.MouseEvent, hostname: string) => void
//
// Status dot colors: --color-status-online, --color-status-offline, --color-status-unknown
// Offline state: greyed-out card with "Last seen: 2h ago" text
// Hover: subtle elevation + border glow (theme transition speed)
```

### 7. Create Sparkline Component

```tsx
// plugins/machine-overview/ui/components/Sparkline.tsx
//
// Tiny inline chart showing CPU/RAM history (last N data points).
// Uses recharts <LineChart> with minimal chrome (no axes, no legend).
//
// Props:
// - data: number[] (values 0-100)
// - color: string (CSS variable reference)
// - height: number (default 24px)
// - width: number (default 80px)
// - animate: boolean (default true)
//
// Color changes based on latest value:
// - < 60%: --color-status-online (green)
// - 60-85%: --color-status-warning (yellow)
// - > 85%: --color-danger (red)
```

### 8. Create Group Header Component

```tsx
// plugins/machine-overview/ui/components/GroupHeader.tsx
//
// Collapsible header for a machine group in the dashboard panel.
//
// Layout:
// ┌── ● SharePoint SE (2/2 Online) ──────────────────── [▼] ─┐
// │   ...machine cards...                                      │
// └────────────────────────────────────────────────────────────┘
//
// Props:
// - group: MachineGroupDetail
// - onlineCount: number
// - totalCount: number
// - isCollapsed: boolean
// - onToggle: () => void
//
// Color swatch: group.color rendered as left border + dot
// Collapsed: hides machine cards, shows summary "2 machines, 2 online"
```

### 9. Create Context Menu Component

```tsx
// plugins/machine-overview/ui/components/MachineContextMenu.tsx
//
// Right-click menu on machine cards.
// Renders plugin command contributions from plugin.json menus.
//
// Menu items:
// - Ping Machine        (machine-overview.get-system-info command)
// - Get System Info      (machine-overview.get-system-info command)
// - ─────────────────── (separator)
// - Open Terminal        (if remote-terminal plugin loaded, Phase 16)
// - View Details         (navigate to /machines/{hostname})
// - ─────────────────── (separator)
// - Add to Group ►       (submenu with available groups)
//
// Props:
// - machine: MachineDetail
// - position: { x: number, y: number }
// - onClose: () => void
// - context: NexusPluginContext
//
// Uses: context.runCommand() for executing plugin commands
// Closes on click outside or Escape key
```

### 10. Create Plugin Scripts

```powershell
# plugins/machine-overview/scripts/ping-all.ps1
# Pings all target machines and returns status.
# Target: all machines (set in command definition)
# Returns: JSON array of { hostname, online, latencyMs }

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    $result = Test-Connection -ComputerName $ComputerName -Count 1 -ErrorAction Stop
    @{
        hostname  = $ComputerName
        online    = $true
        latencyMs = $result.ResponseTime
    } | ConvertTo-Json
}
catch {
    @{
        hostname  = $ComputerName
        online    = $false
        latencyMs = -1
        error     = $_.Exception.Message
    } | ConvertTo-Json
}
```

```powershell
# plugins/machine-overview/scripts/get-system-info.ps1
# Retrieves detailed system information from a single target machine.
# Target: single machine (set in command definition)
# Returns: JSON object with OS, hardware, and network details

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

$os     = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $ComputerName
$cs     = Get-CimInstance -ClassName Win32_ComputerSystem -ComputerName $ComputerName
$cpu    = Get-CimInstance -ClassName Win32_Processor -ComputerName $ComputerName | Select-Object -First 1
$disk   = Get-CimInstance -ClassName Win32_LogicalDisk -ComputerName $ComputerName -Filter "DriveType=3"
$net    = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration -ComputerName $ComputerName |
          Where-Object { $_.IPEnabled }

@{
    hostname        = $ComputerName
    osCaption       = $os.Caption
    osVersion       = $os.Version
    osBuild         = $os.BuildNumber
    lastBoot        = $os.LastBootUpTime.ToString("o")
    uptime          = ((Get-Date) - $os.LastBootUpTime).ToString("dd\.hh\:mm\:ss")
    manufacturer    = $cs.Manufacturer
    model           = $cs.Model
    totalRamMb      = [math]::Round($cs.TotalPhysicalMemory / 1MB)
    cpuName         = $cpu.Name
    cpuCores        = $cpu.NumberOfCores
    cpuLogical      = $cpu.NumberOfLogicalProcessors
    cpuLoadPercent  = $cpu.LoadPercentage
    disks           = @($disk | ForEach-Object {
        @{
            drive    = $_.DeviceID
            sizeMb   = [math]::Round($_.Size / 1MB)
            freeMb   = [math]::Round($_.FreeSpace / 1MB)
            usedPct  = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
        }
    })
    ipAddresses     = @($net | ForEach-Object { $_.IPAddress } | Where-Object { $_ })
    domain          = $cs.Domain
    domainRole      = $cs.DomainRole
} | ConvertTo-Json -Depth 3
```

### 11. Create Plugin README

```markdown
# plugins/machine-overview/README.md

# Machine Overview Plugin

**ID:** `machine-overview`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Provides an at-a-glance view of all machines in the NEXUS environment.
Shows real-time status, CPU/RAM metrics, group organization, and quick actions.

## Contributions
- **Dashboard Panel** — Full-width machine grid with sparklines and status indicators
- **Sidebar Tool** — "Machine Monitor" with expanded cards and filtering
- **Toolbar Widget** — "5/9 Online" badge in the topbar
- **Commands** — "Ping All Machines", "Get System Info"
- **Context Menu** — Right-click actions on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `refresh_interval` | number | 30 | Seconds between auto-refresh |
| `show_offline` | boolean | true | Show offline machines in panel |
| `sparkline_history` | number | 20 | Data points in sparkline chart |
| `compact_mode` | boolean | false | Use compact card layout |

## Scripts
- `scripts/ping-all.ps1` — Tests connectivity to all target machines
- `scripts/get-system-info.ps1` — Retrieves detailed OS/hardware info from a single machine

## Dependencies
- Phase 14: Machine & Group Management (APIs)
- Phase 7: SignalR MetricsHub (live updates)
- Phase 12: Plugin Renderer (component loading)
```

---

## API Endpoints Consumed

This plugin does NOT produce new API endpoints. It consumes existing endpoints from Phases 2 and 14:

| Method | Endpoint | Source Phase | Usage |
|--------|----------|-------------|-------|
| GET | `/api/machines` | Phase 14 | Fetch all machines with live status |
| GET | `/api/machines/{hostname}` | Phase 14 | Fetch single machine detail |
| POST | `/api/machines/{hostname}/ping` | Phase 2 | Ping single machine |
| GET | `/api/machines/groups` | Phase 14 | Fetch groups for grouping display |
| GET | `/api/plugins/machine-overview` | Phase 6 | Read plugin config values |
| WS | `/hubs/metrics` | Phase 7 | Subscribe to live metrics stream |

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/machine-overview/plugin.json` | Create | Full manifest |
| `plugins/machine-overview/ui/Panel.tsx` | Create | Dashboard panel — machine grid |
| `plugins/machine-overview/ui/Tool.tsx` | Create | Sidebar tool — machine monitor |
| `plugins/machine-overview/ui/Widget.tsx` | Create | Toolbar widget — online count badge |
| `plugins/machine-overview/ui/Settings.tsx` | Create | Plugin settings page |
| `plugins/machine-overview/ui/components/MiniCard.tsx` | Create | Compact machine card for panel |
| `plugins/machine-overview/ui/components/Sparkline.tsx` | Create | Inline CPU/RAM sparkline chart |
| `plugins/machine-overview/ui/components/GroupHeader.tsx` | Create | Collapsible group section header |
| `plugins/machine-overview/ui/components/MachineContextMenu.tsx` | Create | Right-click context menu |
| `plugins/machine-overview/scripts/ping-all.ps1` | Create | Ping all targets script |
| `plugins/machine-overview/scripts/get-system-info.ps1` | Create | System info retrieval script |
| `plugins/machine-overview/README.md` | Create | Plugin documentation |

---

## Integration Points

- **Phase 6 (Plugin Loader):** `plugin.json` is discovered and loaded on startup. Plugin ID `machine-overview` is registered in the in-memory plugin registry.
- **Phase 7 (SignalR):** Panel and Tool components subscribe to `MetricsHub` to receive live `MachineMetrics` events every 5 seconds. Widget subscribes to update online count.
- **Phase 12 (Plugin Renderer):** `Panel.tsx` is rendered inside `DashboardGrid` via `<PluginRenderer pluginId="machine-overview" slot="panel" />`. `Tool.tsx` is rendered at `/plugins/machine-overview/machine-monitor`. `Widget.tsx` is rendered in the topbar.
- **Phase 13 (Dashboard Grid):** Panel occupies the default layout position: Row 1, full width (w:12, h:5). Users can resize/move it.
- **Phase 14 (Machine Management):** All machine/group data is fetched from Phase 14's `MachinesController` endpoints. The plugin receives `NexusPluginContext` with pre-authenticated `api` instance.
- **Phase 3 (Script Executor):** "Ping All" and "Get System Info" commands are executed via `context.runCommand()` which calls `POST /api/scripts/run` (Phase 3).

---

## Test Criteria
- [ ] `plugins/machine-overview/plugin.json` validates as valid JSON matching Phase 6 schema
- [ ] Plugin appears in `GET /api/plugins` after service starts
- [ ] Dashboard at `/` shows machine-overview panel at default position (row 1, full width)
- [ ] Panel displays all machines organized by group with colored group headers
- [ ] Online machines show green dot, CPU sparkline, and RAM percentage bar
- [ ] Offline machines show red dot, greyed-out card with "Last seen" timestamp
- [ ] Sparkline chart updates in real-time via SignalR (no page refresh needed)
- [ ] Sparkline color changes: green (<60%), yellow (60-85%), red (>85%)
- [ ] Clicking a machine card navigates to `/machines/{hostname}` (Phase 14 detail page)
- [ ] Right-click shows context menu with "Ping", "Get System Info", "View Details"
- [ ] "Ping All" command executes `ping-all.ps1` on all machines and shows results
- [ ] "Get System Info" command executes `get-system-info.ps1` and displays JSON results
- [ ] Sidebar shows "Machine Monitor" under System group
- [ ] Sidebar tool view shows expanded machine list with search/filter controls
- [ ] Toolbar widget shows "5/9 Online" (or actual count) with appropriate color
- [ ] Clicking toolbar widget navigates to `/machines`
- [ ] Panel auto-refreshes every 30 seconds (configurable via settings)
- [ ] Settings page allows changing refresh interval, show_offline, sparkline_history, compact_mode
- [ ] Compact mode renders smaller cards with less detail
- [ ] Plugin error boundary catches rendering failures without crashing the dashboard
- [ ] All components use CSS variable theme tokens (no hardcoded colors)
- [ ] `npm run build` includes plugin components without errors

---

## Sub-Phase Breakdown (if needed)
- **15-0:** `plugin.json` manifest + `README.md` + plugin folder structure
- **15-1:** Toolbar Widget (`Widget.tsx`) — simplest component, validates plugin rendering pipeline
- **15-2:** MiniCard + Sparkline + GroupHeader sub-components
- **15-3:** Dashboard Panel (`Panel.tsx`) — machine grid with groups, status, sparklines
- **15-4:** SignalR integration — live metrics subscription + sparkline history
- **15-5:** Context menu (`MachineContextMenu.tsx`) + command execution
- **15-6:** Sidebar Tool (`Tool.tsx`) — expanded machine monitor view
- **15-7:** Settings page (`Settings.tsx`) + config persistence
- **15-8:** PowerShell scripts (`ping-all.ps1`, `get-system-info.ps1`)
- **15-9:** Auto-refresh, responsive layout, compact mode polish

---

## Notes for Coding Agent
- This is the **first real plugin** — it serves as the reference implementation. Follow `plugins/_template/` structure exactly. Future plugin authors will copy this pattern.
- Plugin components are NOT bundled into the main React app. They live in `plugins/machine-overview/ui/` and are loaded dynamically by the Plugin Renderer (Phase 12) via `React.lazy(() => import('/plugins/machine-overview/ui/Panel'))`.
- All plugin components receive `NexusPluginContext` as a prop from the Plugin Renderer. Use `context.api` for HTTP calls, `context.signalr` for WebSocket subscriptions, `context.machines` for cached machine data.
- Plugin components must be **default exports**: `export default function Panel({ context }: PanelProps) { ... }`.
- Do NOT import directly from `src/Nexus.Frontend/src/components/`. Plugin components should be self-contained. However, they CAN use the same npm packages (React, recharts, lucide-react) since those are available in the global scope.
- The shared components built in Phase 14 (StatusBadge, TagChip, MetricsBar) live in the main app bundle. The plugin should reimplement similar components locally OR the Phase 12 renderer should expose them via the plugin context. Decide based on Phase 12's final architecture.
- Sparkline data: maintain a rolling buffer of the last N (default 20) `MetricsPayload` snapshots per machine. Store in component state. On each SignalR `MachineMetrics` event, push new value and shift oldest.
- Group ordering in the panel: sort by `MachineGroupEntity.SortOrder`, then alphabetically by label. Ungrouped machines go in an "Ungrouped" section at the bottom.
- Context menu items should check if related plugins are loaded before showing. For example, "Open Terminal" should only appear if the `remote-terminal` plugin is loaded (check via `context.plugins`).
- The `ping-all.ps1` script targets the `$ComputerName` parameter injected by the Script Executor (Phase 3). When target is "all", the executor runs the script once per machine with `$ComputerName` set to each hostname.
- Panel auto-refresh: use `setInterval` with the configured interval. Clear on unmount. Also refresh on SignalR reconnect.
- Theme compliance: every color, font size, border radius, and spacing must come from CSS variables. Test with all 4 built-in themes (dark-default, light, cyberpunk, midnight-blue).

