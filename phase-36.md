# Phase 36 — SharePoint Dist. Cache & ULS Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `sp-cache-uls` plugin — a specialized diagnostic tool for SharePoint farms. It enables administrators to manage Distributed Cache clusters and stream Universal Logging System (ULS) logs directly to the browser with real-time filtering, replacing the need for local ULS Viewer tools on the server.

---

## Context: What is NEXUS?
Troubleshooting SharePoint errors invariably requires reading the ULS logs (`Merge-SPLogFile`). Usually, administrators remote into a WFE, open ULSViewer, and try to catch errors as they happen. Phase 36 brings this capability to the web, alongside management tools for the notoriously fragile Distributed Cache service.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/sp-cache-uls/plugin.json` — plugin manifest
- Sidebar tool: Dist. Cache & ULS Viewer
- **Distributed Cache Tab:**
  - View Cache Hosts and their status (Up/Down)
  - View Memory allocation and Cache port usage
  - Operations: Restart AppFabric Service, Graceful Stop, Clear Cache
- **ULS Viewer Tab:**
  - Live tailing of ULS logs from a selected server
  - Filtering by Correlation ID (crucial for SP troubleshooting)
  - Filtering by Level (Unexpected, High, Monitorable)
- PowerShell scripts: `scripts/manage-cache.ps1`, `scripts/tail-uls.ps1`

**Out of scope:**
- Reprovisioning the entire Distributed Cache cluster from scratch
- Analyzing massive offline ULS log dumps (this is a live streaming tool, not an offline analyzer)

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 3 (Script Executor — for the long-running log tailing process)
- Phase 34 (SharePoint Farm Health — establishes SP baseline)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Cache Ops | PowerShell (`DistributedCacheConfiguration`) |
| ULS Ops | PowerShell (`Get-SPLogEvent` or raw file tailing `Get-Content -Wait`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/sp-cache-uls/plugin.json
{
  "id": "sp-cache-uls",
  "name": "SP Cache & ULS",
  "description": "Manage Distributed Cache and live-tail SharePoint ULS logs.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "SharePoint",
  "icon": "database-zap",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "cache-uls",
        "title": "Cache & ULS",
        "icon": "database-zap",
        "component": "ui/Tool",
        "sidebar_group": "SharePoint",
        "sidebar_order": 22
      }
    ]
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/sp-cache-uls/ui/Tool.tsx
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  SP Cache & ULS Viewer                                           │
// │  Target: [SP-WFE01 ▼]                                            │
// ├──────────────────────────────────────────────────────────────────┤
// │  [ Distributed Cache ]  [ Live ULS Logs ]                        │
// ├──────────────────────────────────────────────────────────────────┤
// │  Correlation ID: [ xxxx-xxxx... ]  Level: [ Unexpected, High ▼ ] │
// │  [▶ Start Streaming] [■ Stop] [⎚ Clear Screen]                    │
// ├──────────────────────────────────────────────────────────────────┤
// │  Timestamp      │ Level      │ Category  │ Message               │
// │  ───────────────┼────────────┼───────────┼────────────────────── │
// │  10:00:15.22    │ High       │ Database  │ Unknown SQL Error     │
// │  10:00:16.01    │ Unexpected │ Runtime   │ Null Reference...     │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

## ULS Log Retrieval — Mandatory Constraints

### ✅ ONLY PERMITTED PATTERN

```powershell
# plugins/sp-cache-uls/scripts/tail-uls.ps1
param(
    [int]$WindowMinutes = 5,
    [int]$MaxRecords = 500,
    [string[]]$FilterLevels = @("Unexpected", "High", "Critical")
)

# Always time-windowed. Always area-filtered. Never full file reads.
Get-SPLogEvent `
    -StartTime (Get-Date).AddMinutes(-$WindowMinutes) `
    -EndTime   (Get-Date) |
Where-Object { $_.Level -in $FilterLevels } |
Select-Object -First $MaxRecords |
Select-Object Timestamp, Area, Category, Level, Message |
ConvertTo-Json -Compress
```

### Cursor-Based Incremental Retrieval

```csharp
public class UlsLogCursor
{
    public DateTime LastReadTimestamp { get; set; } = DateTime.UtcNow.AddMinutes(-5);
    public string MachineId { get; set; }

    // Advance cursor — only retrieve entries AFTER last read
    public string BuildPowerShellQuery(int windowMinutes = 5, int maxRecords = 500)
    {
        return $@"
            Get-SPLogEvent -StartTime '{LastReadTimestamp:yyyy-MM-dd HH:mm:ss}' |
            Where-Object {{ $_.Level -in 'Warning','Error','Critical' }} |
            Select-Object -First {maxRecords} |
            Select-Object Timestamp,Area,Category,Level,Message |
            ConvertTo-Json -Compress
        ";
    }
}
```

### 🚫 EXPLICITLY PROHIBITED

| Prohibited Action | Reason |
|---|---|
| `Get-Content -Path "C:\...\*.log"` | Reads multi-GB files into WinRM session memory |
| `Copy-Item` of ULS log files | Network transfer of unfiltered logs |
| Continuous file polling (`FileSystemWatcher` over WinRM) | Not supported; resource leak |
| Streaming raw log bytes | WinRM memory quota exceeded |
| Querying without `-Area` or `-StartTime` filter | Full scan — production timeout |

### 4. Create Plugin README

Create `README.md` explaining the streaming architecture.

---

## Files to Create/Modify
- `plugins/sp-cache-uls/plugin.json`
- `plugins/sp-cache-uls/ui/Tool.tsx`
- `plugins/sp-cache-uls/scripts/manage-cache.ps1`
- `plugins/sp-cache-uls/scripts/tail-uls.ps1`
- `plugins/sp-cache-uls/README.md`

---

## Test Criteria
- [ ] Successfully queries Distributed Cache cluster status.
- [ ] ULS log streaming returns data in real-time when a Correlation ID is provided.

---

## Sub-Phase Breakdown (if needed)
- **36-0:** Plugin manifest + README + folder structure
- **36-1:** Scripts implementation
- **36-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.


