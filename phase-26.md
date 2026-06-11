# Phase 26 — Firewall Manager Plugin (Windows Defender Firewall)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `firewall-manager` plugin — a web interface for managing Windows Defender Firewall rules. It allows administrators to view, enable, disable, create, and delete firewall rules across managed machines. It provides a searchable, sortable interface for both inbound and outbound rules, replacing the complex `wf.msc` MMC snap-in.

---

## Context: What is NEXUS?
Firewall management is critical for server security, especially in complex environments like SharePoint farms where specific ports (e.g., Distributed Cache, SQL) must be opened. Modifying these via Group Policy is best for enterprise consistency, but local troubleshooting and ad-hoc rule creation often require RDP. Phase 26 brings this to NEXUS, using the `NetSecurity` PowerShell module to provide full visibility and control over local firewall rules.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/firewall-manager/plugin.json` — plugin manifest
- Sidebar tool: full-page firewall manager interface
- Dashboard panel: Firewall profile status summary (Domain/Private/Public enabled states)
- Rule listing: Inbound and Outbound rules with details (Action, Profile, Enabled, Protocol, Local/Remote Ports)
- Filtering & Search: by rule name, direction, action (Block/Allow), and status (Enabled/Disabled)
- Rule Operations: Enable, Disable, Delete
- Basic Rule Creation: Create simple Port or Program-based rules
- Rule Detail Drawer: full properties of a selected rule
- PowerShell scripts: `scripts/get-firewall.ps1`, `scripts/manage-firewall.ps1`
- Context menu contribution: "Manage Firewall" on machine cards (Phase 15)

**Out of scope:**
- Advanced IPsec rule management (connection security rules)
- Complex rule creation with multiple remote IP scopes and custom ICMP types (focus on the 90% use case: Port/Program)

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing `NetSecurity` commands remotely)
- Phase 3 (Script Executor — for running the management scripts)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Firewall retrieval & management | PowerShell (`Get-NetFirewallRule`, `Set-NetFirewallRule`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/firewall-manager/plugin.json
{
  "id": "firewall-manager",
  "name": "Firewall Manager",
  "description": "Manage Windows Defender Firewall rules. View profiles, enable/disable rules, and create new port/program rules directly from the browser.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "shield-alert",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "firewall-status",
        "title": "Firewall Status",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 300,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "firewall",
        "title": "Firewall Manager",
        "icon": "shield-alert",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 12
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "firewall-manager.manage",
        "title": "Manage Firewall",
        "icon": "shield-alert",
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
        "command": "firewall-manager.manage"
      }
    ],
    "settings_page": {
      "id": "firewall-manager-settings",
      "title": "Firewall Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "hide_disabled_rules": {
      "type": "boolean",
      "default": false,
      "label": "Hide disabled rules by default"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/firewall-manager/ui/Panel.tsx
//
// Shows the active firewall profiles for a selected machine.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Firewall Status (DC01 ▼)               [Open ↗]     │
// ├──────────────────────────────────────────────────────┤
// │  Domain Profile:                                     │
// │  [X] Firewall: ON     [ ] Inbound: Block             │
// │                       [ ] Outbound: Allow            │
// │                                                      │
// │  Private Profile:                                    │
// │  [X] Firewall: ON     [ ] Inbound: Block             │
// │                       [ ] Outbound: Allow            │
// │                                                      │
// │  Public Profile:                                     │
// │  [!] Firewall: OFF    [ ] Inbound: Allow (Warning)   │
// │                       [ ] Outbound: Allow            │
// └──────────────────────────────────────────────────────┘
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/firewall-manager/ui/Tool.tsx
//
// Full-page firewall management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Firewall Manager                                                │
// │  Target: [DC01 ▼]               [+ New Rule]                   │
// ├──────────────────────────────────────────────────────────────────┤
// │  [Search rules...]  [Dir: Inbound ▼] [Action: All ▼]             │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  Name                  │ Group     │ Profile │ Protocol │ LocalPort│
// │  ──────────────────────┼───────────┼─────────┼──────────┼───────── │
// │  [X] World Wide Web... │ IIS       │ Any     │ TCP      │ 80, 443  │
// │  [ ] Remote Desktop... │ RDP       │ Domain  │ TCP      │ 3389     │
// │  [X] Core Net (Ping)   │ Core Net  │ Any     │ ICMPv4   │ Any      │
// │  ...                                                             │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: World Wide Web Services (HTTP/HTTPS)                  │
// │  [⊘ Disable] [🗑 Delete] [Details ↗]                            │
// └──────────────────────────────────────────────────────────────────┘
```

### 4. Create Rule Details Drawer Component

```tsx
// plugins/firewall-manager/ui/components/RuleDetails.tsx
//
// Slide-out drawer showing full details for a firewall rule.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   Rule Details                  │
// ├──────────────────────────────────────────┤
// │  Name:          World Wide Web Services  │
// │  Description:   Allows HTTP/HTTPS traffic│
// │  Group:         IIS                      │
// │  Enabled:       Yes                      │
// │  Action:        Allow                    │
// │  Direction:     Inbound                  │
// ├──────────────────────────────────────────┤
// │  Profiles:      Domain, Private, Public  │
// │  Program:       System                   │
// │  Local Address: Any                      │
// │  Remote Address:Any                      │
// │  Protocol:      TCP                      │
// │  Local Port:    80, 443                  │
// │  Remote Port:   Any                      │
// ├──────────────────────────────────────────┤
// │  [⊘ Disable Rule]                        │
// └──────────────────────────────────────────┘
```

### 5. Create PowerShell Scripts

```powershell
# plugins/firewall-manager/scripts/get-firewall.ps1
# Retrieves firewall profiles and rules.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Direction = "Inbound" # 'Inbound', 'Outbound', 'Both'
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($dir)
        
        $profiles = Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction
        
        $ruleFilter = @{}
        if ($dir -ne 'Both') {
            $ruleFilter.Direction = $dir
        }
        
        $rules = Get-NetFirewallRule @ruleFilter | Select-Object Name, DisplayName, Description, DisplayGroup, Enabled, Profile, Direction, Action
        
        $portFilters = Get-NetFirewallPortFilter | Group-Object InstanceID -AsHashTable -AsString
        
        $outputRules = @()
        foreach ($r in $rules) {
            $ports = $portFilters[$r.Name]
            $outputRules += @{
                Name = $r.Name
                DisplayName = $r.DisplayName
                Description = $r.Description
                Group = $r.DisplayGroup
                Enabled = $r.Enabled -eq 'True'
                Profile = $r.Profile.ToString()
                Direction = $r.Direction.ToString()
                Action = $r.Action.ToString()
                Protocol = if ($ports) { $ports.Protocol } else { "Any" }
                LocalPort = if ($ports) { $ports.LocalPort } else { "Any" }
                RemotePort = if ($ports) { $ports.RemotePort } else { "Any" }
            }
        }
        
        return @{ profiles = $profiles; rules = $outputRules }
    } -ArgumentList $Direction -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; profiles = $results.profiles; rules = $results.rules } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/firewall-manager/scripts/manage-firewall.ps1
# Handles Enable, Disable, Delete, and basic Create.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'enable', 'disable', 'delete', 'create'
    [string]$RuleName,
    # Parameters for 'create' action
    [string]$DisplayName = "",
    [string]$Direction = "Inbound",
    [string]$RuleAction = "Allow",
    [string]$Protocol = "TCP",
    [string]$LocalPort = ""
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $name, $dispName, $dir, $ruleAct, $proto, $port)
        
        switch ($act) {
            'enable'  { Enable-NetFirewallRule -Name $name -ErrorAction Stop }
            'disable' { Disable-NetFirewallRule -Name $name -ErrorAction Stop }
            'delete'  { Remove-NetFirewallRule -Name $name -ErrorAction Stop }
            'create'  { 
                New-NetFirewallRule -DisplayName $dispName -Direction $dir -Action $ruleAct -Protocol $proto -LocalPort $port -ErrorAction Stop 
            }
            default   { throw "Unknown action: $act" }
        }
    } -ArgumentList $Action, $RuleName, $DisplayName, $Direction, $RuleAction, $Protocol, $LocalPort -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; ruleName = $RuleName; action = $Action } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 6. Create Plugin README

```markdown
# plugins/firewall-manager/README.md

# Firewall Manager Plugin

**ID:** `firewall-manager`
**Category:** System
**Priority:** P2

## Description
Manage Windows Defender Firewall rules and profiles. Search, enable, disable, and create standard port rules remotely.

## Contributions
- **Dashboard Panel** — Firewall profile status
- **Sidebar Tool** — "Firewall Manager"

## Scripts
- `scripts/get-firewall.ps1` — Queries rules and profiles
- `scripts/manage-firewall.ps1` — Modifies rule states
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/firewall-manager/plugin.json` | Create | Full manifest |
| `plugins/firewall-manager/ui/Tool.tsx` | Create | Full firewall manager page |
| `plugins/firewall-manager/ui/Panel.tsx` | Create | Dashboard profile panel |
| `plugins/firewall-manager/ui/components/RuleDetails.tsx`| Create | Drawer for rule details |
| `plugins/firewall-manager/ui/components/CreateRule.tsx` | Create | Modal for creating basic rules |
| `plugins/firewall-manager/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/firewall-manager/scripts/get-firewall.ps1` | Create | Fetch script |
| `plugins/firewall-manager/scripts/manage-firewall.ps1` | Create | Action script |
| `plugins/firewall-manager/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page lists thousands of rules with acceptable performance
- [ ] Inbound/Outbound toggles update the list correctly
- [ ] Disabling a rule successfully reflects in the UI
- [ ] Creating a basic Port rule (e.g., TCP 8080) creates it on the target machine

---

## Sub-Phase Breakdown (if needed)
- **26-0:** Plugin manifest + README + folder structure
- **26-1:** `get-firewall.ps1` and `manage-firewall.ps1` implementations
- **26-2:** UI shell: Tool page and machine selector
- **26-3:** Rule data table with fast local filtering
- **26-4:** Rule Details drawer and state management actions
- **26-5:** Create Rule modal dialog
- **26-6:** Dashboard panel integration

---

## Notes for Coding Agent
- **Performance:** `Get-NetFirewallRule` is notorious for being very slow if you query all properties (PortFilters, AddressFilters, ApplicationFilters). By fetching `Get-NetFirewallPortFilter` separately and grouping them in memory (Hash table lookup), you save significant execution time.
- **Rule Names vs Display Names:** Windows creates unique GUIDs for `Name` while humans read `DisplayName`. Always use `Name` for the `-Name` parameter in modification scripts, but display `DisplayName` in the UI.


