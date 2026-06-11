# Phase 35 — SharePoint Services & IIS Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `sp-iis-manager` plugin for managing IIS application pools, websites, and SharePoint service instances (e.g., SharePoint Timer Service, User Profile Service) across the farm.

---

## Context: What is NEXUS?
When a SharePoint web front-end hangs, the fastest remediation is often recycling the specific IIS Application Pool. Central Admin provides a way to manage Service Instances, but not IIS. Phase 35 combines both into a single pane of glass, utilizing the `WebAdministration` module and SharePoint snap-ins.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/sp-iis-manager/plugin.json` — plugin manifest
- Sidebar tool: IIS & Services Manager
- IIS Tab: View all Application Pools and Sites. Operations: Start, Stop, Recycle App Pool.
- Services Tab: View all SharePoint Service Instances (`Get-SPServiceInstance`) on a specific server. Operations: Start, Stop.
- PowerShell scripts: `scripts/manage-iis.ps1`, `scripts/manage-sp-services.ps1`

**Out of scope:**
- Creating new IIS sites or Application Pools from scratch (focus is strictly on management and remediation of existing ones).

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 34 (SharePoint Farm Health — establishes the SP baseline)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Operations | PowerShell (`WebAdministration`, `Microsoft.SharePoint.PowerShell`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/sp-iis-manager/plugin.json
{
  "id": "sp-iis-manager",
  "name": "SP Services & IIS",
  "description": "Manage IIS Application Pools, Sites, and SharePoint Service Instances.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "SharePoint",
  "icon": "server",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "iis-services",
        "title": "IIS & Services",
        "icon": "server",
        "component": "ui/Tool",
        "sidebar_group": "SharePoint",
        "sidebar_order": 21
      }
    ]
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/sp-iis-manager/ui/Tool.tsx
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  SP Services & IIS                                               │
// │  Target: [SP-WFE01 ▼]                                            │
// ├──────────────────────────────────────────────────────────────────┤
// │  [ IIS Application Pools ]  [ SP Services ]                      │
// ├──────────────────────────────────────────────────────────────────┤
// │  Name                     │ State   │ Identity          │ Apps   │
// │  ─────────────────────────┼─────────┼───────────────────┼────────│
// │  SharePoint - 80          │ Started │ DOMAIN\sp_farm    │ 1      │
// │  SharePoint Central Admin │ Stopped │ DOMAIN\sp_farm    │ 1      │
// │  SecurityTokenService     │ Started │ DOMAIN\sp_apppool │ 1      │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: SharePoint - 80                                       │
// │  [▶ Start] [■ Stop] [↻ Recycle]                                  │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/sp-iis-manager/scripts/manage-iis.ps1
param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'get', 'start', 'stop', 'recycle'
    [string]$Type = "AppPool", # 'AppPool' or 'Site'
    [string]$Name = ""
)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $type, $name)
        Import-Module WebAdministration -ErrorAction Stop
        
        if ($act -eq 'get') {
            $pools = Get-ChildItem IIS:\AppPools | Select-Object Name, State, @{N='Identity';E={$_.processModel.userName}}
            $sites = Get-ChildItem IIS:\Sites | Select-Object Name, State, ID, Bindings
            return @{ appPools = $pools; sites = $sites }
        }
        
        if ($act -eq 'recycle' -and $type -eq 'AppPool') {
            Restart-WebAppPool -Name $name -ErrorAction Stop
            return $true
        }
        # Add start/stop logic...
    } -ArgumentList $Action, $Type, $Name -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 4. Create Plugin README

Create `README.md` explaining the `WebAdministration` module requirement.

---

## Files to Create/Modify
- `plugins/sp-iis-manager/plugin.json`
- `plugins/sp-iis-manager/ui/Tool.tsx`
- `plugins/sp-iis-manager/scripts/manage-iis.ps1`
- `plugins/sp-iis-manager/scripts/manage-sp-services.ps1`
- `plugins/sp-iis-manager/README.md`

---

## Test Criteria
- [ ] Successfully queries IIS Application Pools and their states.
- [ ] Recycling an App Pool executes `Restart-WebAppPool` and updates the UI state.
- [ ] SharePoint service instances (e.g., Timer Service) can be stopped/started successfully.

---

## Sub-Phase Breakdown (if needed)
- **35-0:** Plugin manifest + README + folder structure
- **35-1:** Scripts implementation
- **35-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.



