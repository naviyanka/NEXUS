# Phase 34 — SharePoint Farm Health Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `sp-farm-health` plugin — the core monitoring tool specifically designed for SharePoint Server Subscription Edition (and 2016/2019) farms. It provides a visual overview of the farm topology, database health, Search service status, and critical Health Analyzer rule violations.

---

## Context: What is NEXUS?
The original inspiration for NEXUS was managing complex SharePoint farms. SharePoint Central Administration is slow and often requires RDPing to the CA server. Phase 34 creates a lightning-fast, read-only dashboard that pulls farm topology and health data directly via the `Microsoft.SharePoint.PowerShell` snap-in. 

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/sp-farm-health/plugin.json` — plugin manifest
- Sidebar tool: Farm Health Dashboard
- Farm Topology view: List of servers in the farm and their MinRole assignments
- Database Status: Content database sizes and warning thresholds
- Search Topology: Visual representation of Crawl, Query, and Index components
- Health Analyzer: List of failing Health Analyzer rules (Warnings and Errors)
- PowerShell scripts: `scripts/get-farm-health.ps1`
- Requires execution on a machine with SharePoint installed (NEXUS routes the command automatically if configured).

**Out of scope:**
- Fixing Health Analyzer rules automatically (requires manual intervention or specific scripts)
- Modifying the Search Topology
- SharePoint Online (M365) management

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 3 (Script Executor)
- A managed machine that is part of a SharePoint Server Farm.

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| SharePoint Ops | PowerShell (`Microsoft.SharePoint.PowerShell`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/sp-farm-health/plugin.json
{
  "id": "sp-farm-health",
  "name": "SharePoint Health",
  "description": "Monitor SharePoint Server Farm topology, Search status, and Health Analyzer rules.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "SharePoint",
  "icon": "share-2",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "sp-health-analyzer",
        "title": "SP Health Analyzer",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "refresh_interval": 3600
      }
    ],
    "tools": [
      {
        "id": "sp-health",
        "title": "Farm Health",
        "icon": "activity",
        "component": "ui/Tool",
        "sidebar_group": "SharePoint",
        "sidebar_order": 20
      }
    ]
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/sp-farm-health/ui/Tool.tsx
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  SharePoint Farm Health                                          │
// │  Target: [SP-APP01 ▼]           Farm: sp_config                  │
// ├──────────────────────────────────────────────────────────────────┤
// │  Topology:                                                       │
// │  - SP-APP01 (Application with Search)  [Online]                  │
// │  - SP-WFE01 (Front-end with Dist Cache)[Online]                  │
// │                                                                  │
// │  Health Analyzer (Failing Rules):                                │
// │  [!] Verify that the DCOM permission rules are set correctly     │
// │  [X] Drives are running out of free space (SP-APP01: C:\)        │
// │                                                                  │
// │  Search Topology (Search Service Application):                   │
// │  Admin: SP-APP01 | Crawl: SP-APP01 | Index: SP-APP01 (Active)    │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/sp-farm-health/scripts/get-farm-health.ps1
param([string]$ComputerName = $env:COMPUTERNAME)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue
        
        $farm = Get-SPFarm
        $servers = $farm.Servers | Select-Object Name, Role, Status
        
        $rules = Get-SPHealthAnalysisRule | Where-Object { $_.Status -eq 'Warning' -or $_.Status -eq 'Error' } | Select-Object Category, Status, Title, Explanation
        
        $searchApp = Get-SPEnterpriseSearchServiceApplication -ErrorAction SilentlyContinue
        $searchTopo = if ($searchApp) { Get-SPEnterpriseSearchTopology -SearchApplication $searchApp -Active -ErrorAction SilentlyContinue | Select-Object State, TopologyId } else { $null }
        
        return @{
            FarmBuild = $farm.BuildVersion.ToString()
            Servers = $servers
            FailingRules = $rules
            SearchTopologyStatus = if ($searchTopo) { $searchTopo.State.ToString() } else { "Not Configured" }
        }
    } -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 4. Create Plugin README

Create `README.md` explaining the `Microsoft.SharePoint.PowerShell` snap-in requirement.

---

## Files to Create/Modify
- `plugins/sp-farm-health/plugin.json`
- `plugins/sp-farm-health/ui/Tool.tsx`
- `plugins/sp-farm-health/ui/Panel.tsx`
- `plugins/sp-farm-health/scripts/get-farm-health.ps1`
- `plugins/sp-farm-health/README.md`

---

## Test Criteria
- [ ] Script successfully loads the SharePoint Snap-in and retrieves the farm build version.
- [ ] Server roles (MinRole) are accurately displayed in the topology view.
- [ ] Health Analyzer rules are parsed and categorized into Errors and Warnings correctly.

---

## Sub-Phase Breakdown (if needed)
- **34-0:** Plugin manifest + README + folder structure
- **34-1:** Scripts implementation
- **34-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.



