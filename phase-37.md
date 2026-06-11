# Phase 37 — SharePoint Config Diff & Upgrade Checker

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `sp-config-diff` plugin — a compliance and lifecycle tool for SharePoint farms. It compares the current farm configuration against Microsoft recommended baselines and checks the database schema upgrade status.

---

## Context: What is NEXUS?
Ensuring a farm adheres to best practices (e.g., Object Cache accounts configured, SuperUser/SuperReader accounts set, BLOB cache enabled) is difficult to verify manually. Phase 37 introduces an automated drift-detection mechanism. Additionally, it provides visibility into database upgrade status (`Get-SPDatabase | Where {$_.NeedsUpgrade}`), which is critical after applying Windows Updates (Phase 23).

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/sp-config-diff/plugin.json` — plugin manifest
- Dashboard panel: Database upgrade required alerts (triggers if `NeedsUpgrade` is true)
- Sidebar tool: Config Diff & Lifecycle
- **Upgrade Tab:**
  - View all farm databases and their status (No Action Required, Upgrade Required)
  - Operation: Trigger `Upgrade-SPFarm` or `Upgrade-SPContentDatabase` remotely
- **Config Diff Tab:**
  - Run comparison against predefined JSON baseline rules
  - Display "Pass/Fail" for various farm settings (e.g., MinRole compliance, Antivirus settings in CA)
- PowerShell scripts: `scripts/check-upgrades.ps1`, `scripts/run-config-diff.ps1`

**Out of scope:**
- Automatically remediating config diff failures (Read-only reporting is safer for complex configurations)

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 3 (Script Executor)
- Phase 34 (SharePoint Farm Health)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| SharePoint Ops | PowerShell (`Microsoft.SharePoint.PowerShell`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |

---

## Job Execution Model (MANDATORY for long-running operations)

This phase's operations MUST use the async Job system. No synchronous
wait ExecuteAsync() patterns are permitted for operations exceeding 30 seconds.

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/sp-config-diff/plugin.json
{
  "id": "sp-config-diff",
  "name": "SP Config & Upgrade",
  "description": "Check SharePoint database upgrade status and run configuration baseline comparisons.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "SharePoint",
  "icon": "git-compare",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "sp-upgrade-status",
        "title": "SP Upgrade Status",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "refresh_interval": 86400
      }
    ],
    "tools": [
      {
        "id": "config-diff",
        "title": "Config Diff",
        "icon": "git-compare",
        "component": "ui/Tool",
        "sidebar_group": "SharePoint",
        "sidebar_order": 23
      }
    ]
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/sp-config-diff/ui/Tool.tsx
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  SP Config Diff & Upgrades                                       │
// │  Target: [SP-APP01 ▼]                                            │
// ├──────────────────────────────────────────────────────────────────┤
// │  [ Databases & Upgrades ]  [ Baseline Diff ]                     │
// ├──────────────────────────────────────────────────────────────────┤
// │  Database Name             │ Type            │ Needs Upgrade     │
// │  ──────────────────────────┼─────────────────┼───────────────────│
// │  WSS_Content_80            │ Content         │ No                │
// │  SP_Config                 │ Configuration   │ YES (⚠)           │
// │  WSS_UsageApplication      │ Usage           │ No                │
// ├──────────────────────────────────────────────────────────────────┤
// │  [▶ Run PSConfig] (Warning: Takes farm offline)                  │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/sp-config-diff/scripts/check-upgrades.ps1
param([string]$ComputerName = $env:COMPUTERNAME)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue
        
        $dbs = Get-SPDatabase | Select-Object Name, Type, NeedsUpgrade
        return $dbs
    } -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 4. Create Plugin README

Create `README.md` explaining the PSConfig wrapper logic.

---

## Files to Create/Modify
- `plugins/sp-config-diff/plugin.json`
- `plugins/sp-config-diff/ui/Tool.tsx`
- `plugins/sp-config-diff/ui/Panel.tsx`
- `plugins/sp-config-diff/scripts/check-upgrades.ps1`
- `plugins/sp-config-diff/scripts/run-config-diff.ps1`
- `plugins/sp-config-diff/README.md`

---

## Test Criteria
- [ ] Correctly identifies databases where `NeedsUpgrade` is true.
- [ ] Dashboard panel accurately reports farm upgrade status.

---

## Sub-Phase Breakdown (if needed)
- **37-0:** Plugin manifest + README + folder structure
- **37-1:** Scripts implementation
- **37-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.



