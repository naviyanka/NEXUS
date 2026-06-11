# Phase 19 — Performance Monitor Plugin (Real-Time Metrics + Historical Charts)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `performance-monitor` plugin — a comprehensive real-time and historical performance monitoring tool. Live dashboards display CPU, memory, disk I/O, and network throughput for any machine using recharts line/area charts with data streamed via SignalR. Historical data is sampled and stored in SQLite for trend analysis. Multi-machine comparison mode overlays metrics from different machines on the same chart. This is the visual performance backbone of NEXUS — the plugin administrators keep open all day.

---

## Context: What is NEXUS?
Administrators need constant visibility into server health. Phase 2 built CIM queries for basic CPU/RAM snapshots. Phase 7 built the `MetricsHub` that broadcasts live metrics every 5 seconds. Phase 15's machine-overview shows tiny sparklines. Phase 19 goes deep: full-screen live charts with 1-second resolution, historical trend graphs, per-process CPU/RAM breakdown, disk queue depth, network adapter throughput, and alerting thresholds. Think Windows Performance Monitor (perfmon.exe) in the browser — but across all machines at once.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/performance-monitor/plugin.json` — plugin manifest
- Dashboard panel: compact multi-metric chart (CPU + RAM for selected machine)
- Sidebar tool: full performance monitoring page with tabbed metric categories
- Live charts: CPU %, RAM %, Disk %, Network throughput — real-time line charts
- Historical charts: last 1h / 6h / 24h / 7d metric trends
- Metric categories: CPU, Memory, Disk, Network (tabbed layout)
- CPU detail: total %, per-core breakdown, top processes by CPU
- Memory detail: used/free/committed, page faults, pool sizes
- Disk detail: per-drive usage, read/write IOPS, queue length
- Network detail: per-adapter bytes sent/received, bandwidth %
- Multi-machine comparison: overlay 2–4 machines on the same chart
- Historical data storage: SQLite table for sampled metric snapshots
- Alert threshold lines: configurable warning/critical levels on charts
- SignalR live streaming via `MetricsHub` (Phase 7)
- CIM performance counters for detailed metrics
- PowerShell scripts: `scripts/get-performance.ps1`, `scripts/get-top-processes.ps1`, `scripts/get-disk-io.ps1`, `scripts/get-network-stats.ps1`

**Out of scope:**
- Custom performance counters (future enhancement)
- Alerting/notification triggers (Phase 41 — Alert Manager)
- Performance baseline comparison (Phase 38 — NEXUS Exclusive)
- GPU metrics (not available via standard CIM)

---

## Prerequisites
- Phase 2 (WinRM/CIM — queries `Win32_PerfFormattedData_*` classes)
- Phase 5 (SQLite — new `performance_history` table for trend storage)
- Phase 7 (SignalR — `MetricsHub` for live metric streaming)
- Phase 12 (Plugin Renderer — loads Panel and Tool components)
- Phase 13 (Dashboard Grid — hosts the performance panel)
- Phase 14 (Machine Management — machine list for selector)
- Phase 15 (Machine Overview — context menu integration)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Live charts | `recharts` (LineChart, AreaChart, BarChart, ComposedChart) |
| Real-time data | SignalR `MetricsHub` (Phase 7) |
| CIM queries | `Win32_PerfFormattedData_PerfOS_Processor`, `_Memory`, `_PhysicalDisk`, `Win32_PerfFormattedData_Tcpip_NetworkInterface` |
| History storage | SQLite `performance_history` table |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens (Phase 11) |
| Scripts | PowerShell 5.1+ |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/performance-monitor/plugin.json
{
  "id": "performance-monitor",
  "name": "Performance Monitor",
  "description": "Real-time and historical performance monitoring with live charts for CPU, memory, disk, and network. Multi-machine comparison and alerting thresholds.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "activity",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "perf-summary",
        "title": "Performance",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 5 },
        "resizable": true,
        "refresh_interval": 5,
        "data_source": ""
      }
    ],
    "tools": [
      {
        "id": "monitor",
        "title": "Performance Monitor",
        "icon": "activity",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 5
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "performance-monitor.snapshot",
        "title": "Capture Performance Snapshot",
        "icon": "camera",
        "scripts": {
          "powershell": "scripts/get-performance.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      },
      {
        "id": "performance-monitor.top-processes",
        "title": "Show Top Processes by CPU",
        "icon": "bar-chart-3",
        "scripts": {
          "powershell": "scripts/get-top-processes.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "performance-monitor.snapshot"
      },
      {
        "location": "machine_context_menu",
        "command": "performance-monitor.top-processes"
      }
    ],
    "settings_page": {
      "id": "performance-monitor-settings",
      "title": "Performance Monitor Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },

  "config_schema": {
    "live_interval": {
      "type": "number",
      "default": 5,
      "label": "Live update interval (seconds)"
    },
    "history_retention_days": {
      "type": "number",
      "default": 7,
      "label": "History retention (days)"
    },
    "history_sample_interval": {
      "type": "number",
      "default": 60,
      "label": "History sample interval (seconds)"
    },
    "cpu_warning_threshold": {
      "type": "number",
      "default": 80,
      "label": "CPU warning threshold (%)"
    },
    "cpu_critical_threshold": {
      "type": "number",
      "default": 95,
      "label": "CPU critical threshold (%)"
    },
    "ram_warning_threshold": {
      "type": "number",
      "default": 85,
      "label": "RAM warning threshold (%)"
    },
    "ram_critical_threshold": {
      "type": "number",
      "default": 95,
      "label": "RAM critical threshold (%)"
    },
    "disk_warning_threshold": {
      "type": "number",
      "default": 85,
      "label": "Disk warning threshold (%)"
    },
    "chart_data_points": {
      "type": "number",
      "default": 60,
      "label": "Live chart data points to display"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/performance-monitor/ui/Panel.tsx
//
// Compact performance dashboard panel.
// Default size: 6 columns, 5 rows.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Performance  [DC01 ▼]              [Open Monitor →] │
// ├──────────────────────────────────────────────────────┤
// │                                                      │
// │  CPU  52%   ▁▂▃▅▇▅▃▂▃▅▆▅▃▂▁▂▃▅▇▅▃▂▃▅▆▅▃▂▁▂▃▅▇   │
// │             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
// │  RAM  68%   ▃▃▃▃▃▃▄▄▄▅▅▅▅▅▅▅▅▅▅▅▆▆▆▆▆▆▆▆▆▆▆▆▆▆   │
// │             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
// │  Disk 28%   ▁▁▁▁▂▂▁▁▁▃▁▁▁▁▂▁▁▁▁▁▁▁▂▁▁▁▁▁▁▁▂▁▁▁   │
// │             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
// │  Net  12 Mbps  ▁▃▅▂▁▃▅▂▁▃▅▂▁▃▅▂▁▃▅▂▁▃▅▂▁▃▅▂▁▃▅   │
// │                                                      │
// └──────────────────────────────────────────────────────┘
//
// Features:
// - Machine selector dropdown (default: first online machine)
// - 4 mini area charts: CPU, RAM, Disk, Network
// - Current value + rolling sparkline (last 60 data points)
// - Live updates via SignalR MetricsHub
// - Threshold lines: warning (yellow dashed) and critical (red dashed)
// - Values that exceed thresholds flash in warning/critical color
// - Click "Open Monitor →" to navigate to full tool view
// - Compact: designed to fit in 6×5 grid cell

interface PanelProps {
  context: NexusPluginContext;
}
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/performance-monitor/ui/Tool.tsx
//
// Full performance monitoring page.
// Sidebar: System → Performance Monitor
// Route: /plugins/performance-monitor/monitor
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Performance Monitor                                             │
// │  Machine: [DC01 ▼]    Time: [Live ▼]   [Compare Mode ☐]       │
// ├──────────────────────────────────────────────────────────────────┤
// │  [CPU] [Memory] [Disk] [Network] [Processes]    ← Tab bar      │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  CPU Usage                                              52.3%   │
// │  ┌────────────────────────────────────────────────────────────┐ │
// │  │  100% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │
// │  │   95% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─CRIT │ │
// │  │   80% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─WARN │ │
// │  │        ╱╲    ╱╲  ╱╲                                      │ │
// │  │   ╱╲╱╲╱  ╲╱╲╱  ╲╱  ╲╱╲╱╲                               │ │
// │  │                          ╲╱╲╱╲╱╲                         │ │
// │  │     0%                           ╲__                     │ │
// │  │  ─────────────────────────────────────────────────────── │ │
// │  │  -5min            -4min            -3min            Now  │ │
// │  └────────────────────────────────────────────────────────────┘ │
// │                                                                  │
// │  Per-Core Breakdown:                                            │
// │  Core 0: [████████░░░░] 65%    Core 1: [██████░░░░░░] 48%     │
// │  Core 2: [████████████] 98%    Core 3: [████░░░░░░░░] 32%     │
// │                                                                  │
// │  Top Processes by CPU:                                          │
// │  sqlservr.exe      32.1%    w3wp.exe        12.4%              │
// │  svchost.exe (DWM)  8.2%    powershell.exe   4.1%              │
// │                                                                  │
// └──────────────────────────────────────────────────────────────────┘
//
// Tab views:
// - CPU: total %, per-core bars, top processes, processor queue length
// - Memory: used/free/committed chart, page faults/sec, pool paged/nonpaged
// - Disk: per-drive usage bars, read/write IOPS chart, avg queue length chart
// - Network: per-adapter throughput chart, bytes sent/received, bandwidth %
// - Processes: full process list sorted by CPU/RAM (links to Phase 21)
//
// Time range selector:
// - Live (streaming, 5-minute window)
// - Last 1 Hour (from history)
// - Last 6 Hours
// - Last 24 Hours
// - Last 7 Days
// - Custom range (date-time picker)
//
// Compare Mode:
// - Select 2-4 machines
// - Overlays their metrics on the same chart with different colors
// - Legend shows machine hostnames with color keys

interface ToolProps {
  context: NexusPluginContext;
}

// State:
// - selectedMachine: string
// - activeTab: 'cpu' | 'memory' | 'disk' | 'network' | 'processes'
// - timeRange: 'live' | '1h' | '6h' | '24h' | '7d' | 'custom'
// - customRange: { start: Date, end: Date } | null
// - compareMode: boolean
// - compareMachines: string[]
// - liveData: Map<string, MetricDataPoint[]>  (rolling buffer)
// - historyData: MetricDataPoint[] (from SQLite)
// - isLoading: boolean
```

### 4. Create Live Chart Component

```tsx
// plugins/performance-monitor/ui/components/LiveChart.tsx
//
// Recharts-based real-time line/area chart that updates with SignalR data.
//
// Features:
// - Smooth animated updates as new data points arrive
// - Configurable data window (default 60 points = 5 min at 5s interval)
// - Warning threshold line (yellow dashed horizontal)
// - Critical threshold line (red dashed horizontal)
// - Gradient fill under the line (green→yellow→red based on value)
// - Tooltip on hover showing exact value + timestamp
// - Y-axis: 0–100% (auto-scales for network bytes)
// - X-axis: time labels (relative: "-5m", "-4m", ... "Now")
// - Multi-series support for compare mode (different colored lines)
// - Responsive: fills container width, configurable height
//
// Props:
// - data: ChartDataPoint[]  (or ChartDataPoint[][] for multi-series)
// - thresholds: { warning: number, critical: number }
// - label: string (e.g., "CPU Usage")
// - unit: string (e.g., "%", "MB/s", "IOPS")
// - color: string (CSS variable for primary line color)
// - height: number (default 300)
// - showGrid: boolean (default true)
// - seriesLabels?: string[]  (for compare mode legend)
// - animate: boolean (default true)

interface ChartDataPoint {
  timestamp: number;   // Unix epoch ms
  value: number;
  label?: string;      // Optional: machine hostname for multi-series
}
```

### 5. Create Historical Chart Component

```tsx
// plugins/performance-monitor/ui/components/HistoryChart.tsx
//
// Chart for historical metric data (1h–7d ranges).
// Uses same recharts foundation as LiveChart but with different data handling.
//
// Differences from LiveChart:
// - Data loaded from SQLite via GET /api/performance/history
// - X-axis: absolute timestamps with appropriate granularity
//   - 1h: every 1 minute
//   - 6h: every 5 minutes
//   - 24h: every 15 minutes
//   - 7d: every 1 hour
// - Zoom: click-drag to zoom into a time range
// - Pan: shift+drag to pan the time window
// - Brush selector: recharts <Brush> at bottom for range selection
// - Min/Max/Avg annotations on hover
// - Loading skeleton while fetching history
//
// Props:
// - hostname: string
// - metric: 'cpu' | 'ram' | 'disk' | 'network'
// - timeRange: '1h' | '6h' | '24h' | '7d' | 'custom'
// - customRange?: { start: Date, end: Date }
// - thresholds: { warning: number, critical: number }
// - context: NexusPluginContext
```

### 6. Create CPU Detail Tab Component

```tsx
// plugins/performance-monitor/ui/components/CpuTab.tsx
//
// CPU metrics detail view (tab content).
//
// Sections:
// 1. Total CPU % — large live chart (LiveChart or HistoryChart based on time range)
// 2. Per-Core Breakdown — horizontal bar chart showing each core's usage
// 3. Top 10 Processes by CPU — sorted table with process name, PID, CPU%
// 4. Processor Queue Length — small chart (should be < 2× core count)
//
// CIM queries:
// - Win32_PerfFormattedData_PerfOS_Processor (total + per-core)
// - Win32_PerfFormattedData_PerfOS_System (ProcessorQueueLength)
// - Top processes: script get-top-processes.ps1
//
// Props:
// - hostname: string
// - timeRange: TimeRange
// - liveData: MetricDataPoint[]
// - settings: PerformanceSettings
// - context: NexusPluginContext
```

### 7. Create Memory Detail Tab Component

```tsx
// plugins/performance-monitor/ui/components/MemoryTab.tsx
//
// Memory metrics detail view.
//
// Sections:
// 1. Memory Usage — stacked area chart (Used / Free / Cached)
// 2. Memory Summary — cards showing: Total, Used, Free, Committed, Cached
// 3. Page Faults/sec — small line chart
// 4. Pool Memory — paged pool + nonpaged pool sizes
// 5. Top 10 Processes by RAM — sorted table with process name, PID, Working Set MB
//
// CIM queries:
// - Win32_PerfFormattedData_PerfOS_Memory (AvailableMBytes, CommittedBytes, PageFaultsPersec, PoolPagedBytes, PoolNonpagedBytes)
// - Win32_OperatingSystem (TotalVisibleMemorySize, FreePhysicalMemory)
//
// Props: same as CpuTab
```

### 8. Create Disk Detail Tab Component

```tsx
// plugins/performance-monitor/ui/components/DiskTab.tsx
//
// Disk metrics detail view.
//
// Sections:
// 1. Drive Usage — horizontal bar chart per logical drive (C:, D:, etc.)
//    Showing used/free with color: green (<85%), yellow (85-95%), red (>95%)
// 2. Disk I/O — dual-axis chart: read IOPS (line) + write IOPS (line)
// 3. Avg Disk Queue Length — line chart (should be < 2 for healthy disk)
// 4. Disk Transfer Rate — MB/s read + write
// 5. Drive Details — table: drive letter, file system, total, free, used %
//
// CIM queries:
// - Win32_PerfFormattedData_PerfDisk_PhysicalDisk (DiskReadsPersec, DiskWritesPersec, AvgDiskQueueLength, DiskTransfersPersec)
// - Win32_LogicalDisk (Size, FreeSpace, FileSystem, DriveType)
//
// Props: same as CpuTab
```

### 9. Create Network Detail Tab Component

```tsx
// plugins/performance-monitor/ui/components/NetworkTab.tsx
//
// Network metrics detail view.
//
// Sections:
// 1. Network Throughput — dual line chart: bytes sent/sec + bytes received/sec
// 2. Adapter Selector — dropdown if multiple NICs (exclude loopback, disconnected)
// 3. Bandwidth Utilization — percentage of link speed
// 4. Adapter Details — table: adapter name, speed, MAC, IP, status
// 5. Connection Stats — TCP connections established, time-wait count
//
// CIM queries:
// - Win32_PerfFormattedData_Tcpip_NetworkInterface (BytesSentPersec, BytesReceivedPersec, CurrentBandwidth)
// - Win32_NetworkAdapterConfiguration (IPAddress, MACAddress, DefaultIPGateway)
// - Win32_PerfFormattedData_Tcpip_TCPv4 (ConnectionsEstablished)
//
// Props: same as CpuTab + selectedAdapter: string
```

### 10. Create Process List Tab Component

```tsx
// plugins/performance-monitor/ui/components/ProcessTab.tsx
//
// Process list sorted by resource usage.
// Links to Phase 21 (Process Manager Plugin) if loaded.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────┐
// │  [Search...] [Sort: CPU ▼] [Show: All ▼]                   │
// ├──────────────────────────────────────────────────────────────┤
// │  Name              │ PID   │ CPU%  │ RAM (MB) │ Status      │
// │  ──────────────────┼───────┼───────┼──────────┼──────────── │
// │  sqlservr.exe      │ 1284  │ 32.1  │ 2,048    │ Running     │
// │  w3wp.exe          │ 4120  │ 12.4  │ 512      │ Running     │
// │  svchost.exe (DWM) │ 892   │  8.2  │ 128      │ Running     │
// │  powershell.exe    │ 6740  │  4.1  │ 96       │ Running     │
// │  ...                                                        │
// └──────────────────────────────────────────────────────────────┘
//
// Features:
// - Sortable by CPU% or RAM
// - Search by process name
// - Auto-refresh every 5 seconds (live mode)
// - Click process → navigate to Process Manager (Phase 21) if loaded
// - "Kill Process" context menu (with confirmation)
```

### 11. Create Backend — Performance History Service

```csharp
// src/Nexus.Gateway/Core/PerformanceHistoryService.cs
//
// Background service that samples metrics at regular intervals
// and stores them in SQLite for historical chart queries.
//
// Runs as IHostedService alongside MachineStatusService (Phase 2)
// Samples every 60 seconds (configurable):
//   For each active machine:
//     - Query CPU%, RAM%, Disk% via CIM (reuse Phase 2 CimClient)
//     - Write snapshot to performance_history table
//
// Cleanup: delete rows older than retention_days (default 7)

public class PerformanceHistoryService : BackgroundService
{
    // Dependencies: ICimClient, IMachineManagementService, NexusDbContext, ILogger
    // Timer: configurable interval from plugin config (default 60s)
    // Batch insert: collect all machine metrics, single SaveChangesAsync
}
```

### 12. Create Backend — Performance History Table

```sql
-- New SQLite table (add via EF Core migration)
CREATE TABLE performance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hostname TEXT NOT NULL,
    timestamp TEXT NOT NULL,         -- ISO 8601
    cpu_percent REAL,
    ram_percent REAL,
    ram_used_mb INTEGER,
    ram_total_mb INTEGER,
    disk_percent REAL,               -- Primary drive (C:)
    disk_read_iops REAL,
    disk_write_iops REAL,
    network_bytes_sent REAL,
    network_bytes_received REAL
);

CREATE INDEX idx_perf_history_host_time ON performance_history(hostname, timestamp);
```

### 13. Create Backend — Performance API Controller

```csharp
// src/Nexus.Gateway/Controllers/PerformanceController.cs

[ApiController]
[Route("api/performance")]
public class PerformanceController : ControllerBase
{
    [HttpGet("{hostname}/live")]
    // Returns latest cached metrics from MachineStatusService
    // Used as fallback when SignalR is unavailable

    [HttpGet("{hostname}/history")]
    // Query params: metric (cpu|ram|disk|network), range (1h|6h|24h|7d), start, end
    // Returns time-series data from performance_history table
    // Aggregates to appropriate granularity based on range

    [HttpGet("{hostname}/snapshot")]
    // Full point-in-time snapshot: CPU, RAM, all disks, all network adapters
    // Triggers live CIM query (not from cache)

    [HttpGet("{hostname}/processes")]
    // Top N processes sorted by CPU or RAM
    // Uses: Get-Process -ComputerName via WinRM

    [HttpGet("compare")]
    // Query params: hostnames (comma-sep), metric, range
    // Returns aligned time-series for overlay chart
}
```

### 14. Create PowerShell Scripts

```powershell
# plugins/performance-monitor/scripts/get-performance.ps1
# Full performance snapshot from a single machine.
# Returns: JSON with CPU, RAM, Disk, Network details

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    $cpu = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor `
           -ComputerName $ComputerName -Filter "Name='_Total'"
    $mem = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $ComputerName
    $memPerf = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory `
               -ComputerName $ComputerName
    $disks = Get-CimInstance -ClassName Win32_LogicalDisk `
             -ComputerName $ComputerName -Filter "DriveType=3"
    $diskPerf = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk `
                -ComputerName $ComputerName -Filter "Name='_Total'"
    $net = Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface `
           -ComputerName $ComputerName | Where-Object { $_.BytesTotalPersec -gt 0 }

    $totalRamMb = [math]::Round($mem.TotalVisibleMemorySize / 1KB)
    $freeRamMb  = [math]::Round($mem.FreePhysicalMemory / 1KB)

    @{
        success   = $true
        hostname  = $ComputerName
        timestamp = (Get-Date).ToString("o")
        cpu = @{
            totalPercent       = $cpu.PercentProcessorTime
            processorQueueLen  = (Get-CimInstance Win32_PerfFormattedData_PerfOS_System -ComputerName $ComputerName).ProcessorQueueLength
        }
        memory = @{
            totalMb         = $totalRamMb
            usedMb          = $totalRamMb - $freeRamMb
            freeMb          = $freeRamMb
            usedPercent     = [math]::Round((($totalRamMb - $freeRamMb) / $totalRamMb) * 100, 1)
            committedBytes  = $memPerf.CommittedBytes
            pageFaultsSec   = $memPerf.PageFaultsPersec
            poolPagedMb     = [math]::Round($memPerf.PoolPagedBytes / 1MB)
            poolNonpagedMb  = [math]::Round($memPerf.PoolNonpagedBytes / 1MB)
        }
        disks = @($disks | ForEach-Object {
            @{
                drive     = $_.DeviceID
                totalMb   = [math]::Round($_.Size / 1MB)
                freeMb    = [math]::Round($_.FreeSpace / 1MB)
                usedPct   = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
                fileSystem = $_.FileSystem
            }
        })
        diskIo = @{
            readIops   = $diskPerf.DiskReadsPersec
            writeIops  = $diskPerf.DiskWritesPersec
            queueLen   = $diskPerf.AvgDiskQueueLength
            transferMbSec = [math]::Round($diskPerf.DiskBytesPersec / 1MB, 2)
        }
        network = @($net | ForEach-Object {
            @{
                adapter         = $_.Name
                bytesSentSec    = $_.BytesSentPersec
                bytesRecvSec    = $_.BytesReceivedPersec
                bandwidthBits   = $_.CurrentBandwidth
                utilizationPct  = if ($_.CurrentBandwidth -gt 0) {
                    [math]::Round(($_.BytesTotalPersec * 8 / $_.CurrentBandwidth) * 100, 1)
                } else { 0 }
            }
        })
    } | ConvertTo-Json -Depth 4
}
catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/performance-monitor/scripts/get-top-processes.ps1
# Top processes by CPU or RAM usage.

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME,

    [Parameter(Mandatory=$false)]
    [ValidateSet('cpu', 'ram')]
    [string]$SortBy = 'cpu',

    [Parameter(Mandatory=$false)]
    [int]$Top = 10
)

try {
    $procs = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($sort, $top)
        $sortProp = if ($sort -eq 'cpu') { 'CPU' } else { 'WorkingSet64' }
        Get-Process | Sort-Object $sortProp -Descending | Select-Object -First $top |
            Select-Object @{N='name';E={$_.ProcessName}},
                          @{N='pid';E={$_.Id}},
                          @{N='cpuSeconds';E={[math]::Round($_.CPU, 1)}},
                          @{N='ramMb';E={[math]::Round($_.WorkingSet64 / 1MB)}},
                          @{N='threads';E={$_.Threads.Count}},
                          @{N='handles';E={$_.HandleCount}},
                          @{N='status';E={if ($_.Responding) {'Running'} else {'Not Responding'}}}
    } -ArgumentList $SortBy, $Top

    @{ success = $true; hostname = $ComputerName; processes = @($procs) } | ConvertTo-Json -Depth 3
}
catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/performance-monitor/scripts/get-disk-io.ps1
# Disk I/O statistics for all physical disks.

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    $disks = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_PhysicalDisk `
             -ComputerName $ComputerName | Where-Object { $_.Name -ne '_Total' }

    @{
        success = $true
        hostname = $ComputerName
        disks = @($disks | ForEach-Object {
            @{
                name           = $_.Name
                readIops       = $_.DiskReadsPersec
                writeIops      = $_.DiskWritesPersec
                readMbSec      = [math]::Round($_.DiskReadBytesPersec / 1MB, 2)
                writeMbSec     = [math]::Round($_.DiskWriteBytesPersec / 1MB, 2)
                avgQueueLen    = $_.AvgDiskQueueLength
                avgReadLatMs   = $_.AvgDiskSecPerRead * 1000
                avgWriteLatMs  = $_.AvgDiskSecPerWrite * 1000
                idlePercent    = $_.PercentIdleTime
            }
        })
    } | ConvertTo-Json -Depth 3
}
catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/performance-monitor/scripts/get-network-stats.ps1
# Network adapter statistics.

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    $adapters = Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface `
                -ComputerName $ComputerName | Where-Object { $_.BytesTotalPersec -gt 0 }
    $configs  = Get-CimInstance -ClassName Win32_NetworkAdapterConfiguration `
                -ComputerName $ComputerName | Where-Object { $_.IPEnabled }
    $tcp      = Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_TCPv4 `
                -ComputerName $ComputerName -ErrorAction SilentlyContinue

    @{
        success  = $true
        hostname = $ComputerName
        adapters = @($adapters | ForEach-Object {
            $config = $configs | Where-Object { $_.Description -eq $_.Name } | Select-Object -First 1
            @{
                name             = $_.Name
                bytesSentSec     = $_.BytesSentPersec
                bytesReceivedSec = $_.BytesReceivedPersec
                bandwidthBits    = $_.CurrentBandwidth
                packetsSentSec   = $_.PacketsSentPersec
                packetsRecvSec   = $_.PacketsReceivedPersec
                errorsOutSec     = $_.PacketsOutboundErrors
                errorsInSec      = $_.PacketsReceivedErrors
                ipAddress        = if ($config) { $config.IPAddress } else { $null }
                macAddress       = if ($config) { $config.MACAddress } else { $null }
            }
        })
        tcp = @{
            connectionsEstablished = if ($tcp) { $tcp.ConnectionsEstablished } else { 0 }
            connectionsReset       = if ($tcp) { $tcp.ConnectionsReset } else { 0 }
            segmentsSentSec        = if ($tcp) { $tcp.SegmentsSentPersec } else { 0 }
            segmentsRecvSec        = if ($tcp) { $tcp.SegmentsReceivedPersec } else { 0 }
        }
    } | ConvertTo-Json -Depth 4
}
catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 15. Create TypeScript Types

```typescript
// plugins/performance-monitor/ui/types.ts

export interface MetricDataPoint {
  timestamp: number;      // Unix epoch ms
  value: number;
}

export interface PerformanceSnapshot {
  hostname: string;
  timestamp: string;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disks: DiskInfo[];
  diskIo: DiskIoMetrics;
  network: NetworkAdapterMetrics[];
}

export interface CpuMetrics {
  totalPercent: number;
  processorQueueLen: number;
  perCore?: number[];      // Per-core percentages
}

export interface MemoryMetrics {
  totalMb: number;
  usedMb: number;
  freeMb: number;
  usedPercent: number;
  committedBytes: number;
  pageFaultsSec: number;
  poolPagedMb: number;
  poolNonpagedMb: number;
}

export interface DiskInfo {
  drive: string;
  totalMb: number;
  freeMb: number;
  usedPct: number;
  fileSystem: string;
}

export interface DiskIoMetrics {
  readIops: number;
  writeIops: number;
  queueLen: number;
  transferMbSec: number;
}

export interface NetworkAdapterMetrics {
  adapter: string;
  bytesSentSec: number;
  bytesRecvSec: number;
  bandwidthBits: number;
  utilizationPct: number;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  cpuSeconds: number;
  ramMb: number;
  threads: number;
  handles: number;
  status: string;
}

export interface PerformanceSettings {
  liveInterval: number;
  historyRetentionDays: number;
  historySampleInterval: number;
  cpuWarningThreshold: number;
  cpuCriticalThreshold: number;
  ramWarningThreshold: number;
  ramCriticalThreshold: number;
  diskWarningThreshold: number;
  chartDataPoints: number;
}

export type MetricCategory = 'cpu' | 'memory' | 'disk' | 'network' | 'processes';
export type TimeRange = 'live' | '1h' | '6h' | '24h' | '7d' | 'custom';
```

### 16. Create Settings Page

```tsx
// plugins/performance-monitor/ui/Settings.tsx
//
// Settings for Performance Monitor.
//
// Sections:
// - Live Monitoring: update interval (1–30s), chart data points (30–300)
// - History: retention days (1–90), sample interval (30–600s)
// - Thresholds:
//   - CPU warning/critical (0–100%)
//   - RAM warning/critical (0–100%)
//   - Disk warning (0–100%)
//   Shown with preview color bars
// - Display: chart animation toggle, grid lines toggle
```

### 17. Create Plugin README

```markdown
# plugins/performance-monitor/README.md

# Performance Monitor Plugin

**ID:** `performance-monitor`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Real-time and historical performance monitoring for all managed machines.
Live charts for CPU, memory, disk I/O, and network throughput with
configurable alerting thresholds and multi-machine comparison.

## Contributions
- **Dashboard Panel** — Compact multi-metric chart with CPU, RAM, Disk, Network sparklines
- **Sidebar Tool** — "Performance Monitor" with tabbed detail views and historical charts
- **Commands** — "Capture Performance Snapshot", "Show Top Processes by CPU"
- **Context Menu** — Performance actions on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `live_interval` | number | 5 | Live update interval (seconds) |
| `history_retention_days` | number | 7 | Days to retain history data |
| `history_sample_interval` | number | 60 | Seconds between history samples |
| `cpu_warning_threshold` | number | 80 | CPU % warning line |
| `cpu_critical_threshold` | number | 95 | CPU % critical line |
| `ram_warning_threshold` | number | 85 | RAM % warning line |
| `ram_critical_threshold` | number | 95 | RAM % critical line |
| `disk_warning_threshold` | number | 85 | Disk % warning line |
| `chart_data_points` | number | 60 | Live chart data window |

## Scripts
- `scripts/get-performance.ps1` — Full performance snapshot (CPU, RAM, Disk, Network)
- `scripts/get-top-processes.ps1` — Top N processes by CPU or RAM
- `scripts/get-disk-io.ps1` — Per-disk I/O statistics
- `scripts/get-network-stats.ps1` — Per-adapter network throughput

## Dependencies
- Phase 2: WinRM/CIM (performance counter queries)
- Phase 7: SignalR MetricsHub (live streaming)
- Phase 14: Machine Management (machine selector)
```

---

## API Endpoints Produced

Phase 19 introduces a new `PerformanceController`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/performance/{hostname}/live` | Latest cached metrics |
| GET | `/api/performance/{hostname}/history` | Historical time-series data |
| GET | `/api/performance/{hostname}/snapshot` | Full live CIM performance query |
| GET | `/api/performance/{hostname}/processes` | Top processes by CPU or RAM |
| GET | `/api/performance/compare` | Multi-machine metric overlay data |

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/performance-monitor/plugin.json` | Create | Full manifest |
| `plugins/performance-monitor/ui/Panel.tsx` | Create | Dashboard performance panel |
| `plugins/performance-monitor/ui/Tool.tsx` | Create | Full monitoring page with tabs |
| `plugins/performance-monitor/ui/Settings.tsx` | Create | Plugin settings page |
| `plugins/performance-monitor/ui/types.ts` | Create | TypeScript metric types |
| `plugins/performance-monitor/ui/components/LiveChart.tsx` | Create | Real-time recharts line chart |
| `plugins/performance-monitor/ui/components/HistoryChart.tsx` | Create | Historical chart with zoom/brush |
| `plugins/performance-monitor/ui/components/CpuTab.tsx` | Create | CPU detail tab |
| `plugins/performance-monitor/ui/components/MemoryTab.tsx` | Create | Memory detail tab |
| `plugins/performance-monitor/ui/components/DiskTab.tsx` | Create | Disk detail tab |
| `plugins/performance-monitor/ui/components/NetworkTab.tsx` | Create | Network detail tab |
| `plugins/performance-monitor/ui/components/ProcessTab.tsx` | Create | Process list tab |
| `plugins/performance-monitor/scripts/get-performance.ps1` | Create | Full performance snapshot |
| `plugins/performance-monitor/scripts/get-top-processes.ps1` | Create | Top processes by CPU/RAM |
| `plugins/performance-monitor/scripts/get-disk-io.ps1` | Create | Disk I/O statistics |
| `plugins/performance-monitor/scripts/get-network-stats.ps1` | Create | Network adapter stats |
| `plugins/performance-monitor/README.md` | Create | Plugin documentation |
| `src/Nexus.Gateway/Controllers/PerformanceController.cs` | Create | History + snapshot API |
| `src/Nexus.Gateway/Core/PerformanceHistoryService.cs` | Create | Background history sampler |
| `src/Nexus.Gateway/Data/NexusDbContext.cs` | Modify | Add performance_history DbSet |

---

## Integration Points

- **Phase 2 (WinRM/CIM):** All performance data is queried via CIM classes (`Win32_PerfFormattedData_*`) through the WinRM connection pool. Live metrics reuse the `ICimClient` from Phase 2.
- **Phase 5 (SQLite):** New `performance_history` table stores sampled metrics. Requires EF Core migration.
- **Phase 7 (SignalR MetricsHub):** Live chart data comes from the `MetricsHub` broadcast. The plugin subscribes via `context.signalr.subscribe('MachineMetrics', callback)`.
- **Phase 12 (Plugin Renderer):** Panel and Tool components loaded dynamically.
- **Phase 14 (Machine Management):** Machine selector uses `GET /api/machines`.
- **Phase 15 (Machine Overview):** Context menu entries for performance actions.
- **Phase 21 (Process Manager):** Process tab links to Process Manager plugin for detailed process control.

---

## Test Criteria
- [ ] Plugin manifest validates and appears in sidebar under System
- [ ] Dashboard panel shows 4 mini charts (CPU, RAM, Disk, Network) for selected machine
- [ ] Live charts update in real-time every 5 seconds via SignalR
- [ ] CPU tab shows total CPU %, per-core breakdown, and top processes
- [ ] Memory tab shows used/free/committed with stacked area chart
- [ ] Disk tab shows per-drive usage bars and I/O read/write chart
- [ ] Network tab shows per-adapter throughput chart
- [ ] Warning threshold line appears as yellow dashed horizontal
- [ ] Critical threshold line appears as red dashed horizontal
- [ ] Values exceeding thresholds render in warning/critical colors
- [ ] Time range selector: switching from "Live" to "1h" loads historical data
- [ ] Historical chart shows correct time-series from SQLite
- [ ] Brush selector at bottom of history chart allows range selection
- [ ] Compare mode: selecting 2 machines overlays their CPU on same chart with legend
- [ ] `GET /api/performance/DC01/history?metric=cpu&range=24h` returns time-series JSON
- [ ] `GET /api/performance/DC01/snapshot` returns full live CIM performance data
- [ ] Background history service writes snapshots to SQLite every 60 seconds
- [ ] History data older than retention period is cleaned up automatically
- [ ] Process tab shows top 10 processes sorted by CPU
- [ ] Offline machine shows "Machine Offline" state with last known metrics (if cached)
- [ ] All charts use theme-consistent colors from CSS variables
- [ ] `dotnet build` succeeds (new controller + background service)
- [ ] `npm run build` includes plugin without errors

---

## Sub-Phase Breakdown (if needed)
- **19-0:** Plugin manifest + README + folder structure + types
- **19-1:** Backend: `performance_history` table + EF migration + `PerformanceHistoryService`
- **19-2:** Backend: `PerformanceController` — live, history, snapshot, processes, compare
- **19-3:** `LiveChart.tsx` — recharts real-time line chart with thresholds
- **19-4:** `HistoryChart.tsx` — historical chart with zoom/brush
- **19-5:** Dashboard Panel (`Panel.tsx`) — compact 4-metric view
- **19-6:** `CpuTab.tsx` + `MemoryTab.tsx` — detail views + per-core + top processes
- **19-7:** `DiskTab.tsx` + `NetworkTab.tsx` — I/O and throughput charts
- **19-8:** `ProcessTab.tsx` — process list with sort/search
- **19-9:** Tool page (`Tool.tsx`) — wire tabs + machine selector + time range + compare mode
- **19-10:** PowerShell scripts (4 scripts) + settings page + polish

---

## Notes for Coding Agent
- **CIM performance counters**: Use `Win32_PerfFormattedData_*` classes (NOT `Win32_PerfRawData_*`). The "Formatted" variants return pre-calculated values (percentages, per-second rates). The "Raw" variants require manual counter calculations.
- **Per-core CPU**: `Win32_PerfFormattedData_PerfOS_Processor` returns one instance per core (Name="0", "1", etc.) plus "_Total". Query all instances for per-core breakdown.
- **Live vs History**: Live mode subscribes to SignalR MetricsHub (5s interval). History mode queries `performance_history` table. The transition should be seamless — switching from "Live" to "1h" should show the last hour of stored data without a jarring UI change.
- **History sampling**: The `PerformanceHistoryService` runs independently of the live MetricsHub. It samples every 60s (configurable) and writes to SQLite. Don't sample at 5s — SQLite would grow too fast (9 machines × 1 row/5s = 155K rows/day).
- **History aggregation**: For longer time ranges (24h, 7d), aggregate data to reduce point count. 24h at 1-minute granularity = 1,440 points (fine). 7d at 1-minute = 10,080 points (aggregate to 15-minute intervals = 672 points).
- **Recharts performance**: For 300+ data points, disable animation on the chart. Use `isAnimationActive={false}` in recharts components for large datasets. Memoize chart data with `useMemo`.
- **Threshold lines**: Use recharts `<ReferenceLine>` component with `stroke="var(--color-status-warning)"` and `strokeDasharray="5 5"`.
- **Compare mode**: Overlay up to 4 machines. Assign each a consistent color from a palette: accent-1, accent-2, status-warning, danger. Show a legend mapping hostname to color.
- **Network bandwidth**: `CurrentBandwidth` returns link speed in bits/sec (e.g., 1000000000 for 1Gbps). Utilization = (BytesTotalPersec × 8) / CurrentBandwidth × 100.
- **Memory committed bytes**: This is a large number (bytes). Display in GB. Committed = total memory allocated (physical + page file) — if CommittedBytes > physical RAM, the machine is paging.
- **Disk queue length**: Healthy disks have AvgDiskQueueLength < 2. Values > 5 indicate a bottleneck. Color-code: green (<2), yellow (2–5), red (>5).
- **Process CPU%**: `Get-Process` on Windows returns cumulative CPU seconds, not percentage. For real-time CPU%, use `Win32_PerfFormattedData_PerfProc_Process.PercentProcessorTime` instead, but note it returns per-core % (divide by core count for system-wide %).
- **Background service registration**: Add to `Program.cs`: `builder.Services.AddHostedService<PerformanceHistoryService>();`. It should start only if the performance-monitor plugin is loaded (check PluginRegistry).
- **Chart theme**: recharts supports custom colors via props. Map all chart colors to CSS variables. Line color, grid color, axis label color, tooltip background — all from theme tokens.
- **Data cleanup job**: The history cleanup can run inside `PerformanceHistoryService` — on each cycle, check for rows older than retention_days and delete in batches of 1000 to avoid locking SQLite.


