# Phase 30 — Active Directory Plugin (Full)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `active-directory` plugin — a web-based replacement for Active Directory Users and Computers (ADUC) and Active Directory Administrative Center (ADAC). It allows administrators to search the directory, reset passwords, unlock accounts, manage group memberships, and view computer objects directly from the browser without needing RSAT tools installed locally.

---

## Context: What is NEXUS?
Helpdesk and system administrators spend a significant portion of their day resetting passwords, unlocking accounts, and modifying group memberships in AD. Relying on remote desktop or thick clients (RSAT) is cumbersome. By utilizing the `ActiveDirectory` PowerShell module on a designated management machine (or a Domain Controller), Phase 30 brings essential AD management into the NEXUS web UI. 

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/active-directory/plugin.json` — plugin manifest
- Sidebar tool: full-page Active Directory browser
- Navigation: Hierarchical OU (Organizational Unit) tree view
- Search: Fast LDAP-based search for Users, Groups, and Computers
- User Operations: Unlock Account, Reset Password, Disable/Enable Account
- Group Operations: View Members, Add/Remove Members
- Computer Operations: View properties (OS, Last Logon, LAPS password if applicable - future hook)
- Object Details Drawer: Full AD properties (SamAccountName, Email, Department, Manager, etc.)
- PowerShell scripts: `scripts/ad-queries.ps1`, `scripts/ad-manage.ps1`

**Out of scope:**
- Modifying the AD Schema
- Group Policy Object (GPO) management
- Creating complex cross-domain trusts
- Advanced AD Sites and Services replication topologies

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing AD commands remotely)
- Phase 3 (Script Executor — for running the management scripts)
- Phase 12 (Plugin Renderer)
- A managed machine registered in NEXUS that either:
  1. Is a Domain Controller
  2. Has RSAT-AD-PowerShell installed. (The plugin will route commands to this specific machine).

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| AD Operations | PowerShell (`ActiveDirectory` module: `Get-ADUser`, `Set-ADAccountPassword`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/active-directory/plugin.json
{
  "id": "active-directory",
  "name": "Active Directory",
  "description": "Web-based Active Directory Administrative Center. Browse OUs, search objects, reset passwords, and manage group memberships.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "book-user",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "aduc",
        "title": "Active Directory",
        "icon": "book-user",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 16
      }
    ],
    "commands": [
      {
        "id": "active-directory.search",
        "title": "Search AD",
        "icon": "search",
        "scripts": {},
        "default_script": "powershell",
        "target": "single"
      }
    ],
    "settings_page": {
      "id": "active-directory-settings",
      "title": "Active Directory Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "target_dc": {
      "type": "string",
      "default": "",
      "label": "Target Domain Controller (Leave blank to use the machine NEXUS is connected to)"
    },
    "default_search_base": {
      "type": "string",
      "default": "",
      "label": "Default Search Base (e.g., OU=Users,DC=domain,DC=com)"
    }
  }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/active-directory/ui/Tool.tsx
//
// Full-page AD management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Active Directory                                                │
// │  Gateway: [DC01 ▼]              Search: [ jdoe              🔍] │
// ├─────────────┬────────────────────────────────────────────────────┤
// │  > domain.l │ Name             │ Type   │ Description            │
// │   v Corp    │ ─────────────────┼────────┼────────────────────────│
// │    > Users  │ John Doe         │ User   │ Sales Manager          │
// │    > Groups │ Jane Doe         │ User   │ HR Director            │
// │   > Builtin │ Sales Group      │ Group  │ All sales staff        │
// │   > Comput..│                                                    │
// ├─────────────┴────────────────────────────────────────────────────┤
// │  Selected: John Doe (DOMAIN\jdoe)                                │
// │  [🔓 Unlock] [🔑 Reset Password] [⊘ Disable] [Details ↗]          │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create Object Details Drawer Component

```tsx
// plugins/active-directory/ui/components/AdObjectDetails.tsx
//
// Slide-out drawer showing full AD object properties.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   John Doe (User)               │
// ├──────────────────────────────────────────┤
// │  Account Details:                        │
// │  SamAccountName: jdoe                    │
// │  UPN:            jdoe@domain.local       │
// │  Status:         Enabled                 │
// │  Locked Out:     No                      │
// │  Password Last Set: 10/12/2026           │
// ├──────────────────────────────────────────┤
// │  Organization:                           │
// │  Title:          Sales Manager           │
// │  Department:     Sales                   │
// │  Manager:        CN=Boss,OU=Users...     │
// ├──────────────────────────────────────────┤
// │  Member Of:                              │
// │  - Domain Users                          │
// │  - Sales Group                           │
// ├──────────────────────────────────────────┤
// │  [🔑 Reset Password] [👥 Edit Groups]     │
// └──────────────────────────────────────────┘
```

### 4. Create PowerShell Scripts

```powershell
# plugins/active-directory/scripts/ad-queries.ps1
# Retrieves OUs, Users, Groups, Computers.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action = "search", # 'getOUs', 'search', 'getDetails'
    [string]$SearchBase = "",
    [string]$Filter = "*",
    [string]$Server = "" # Target DC if specified
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $base, $flt, $srv)
        
        # Ensure ActiveDirectory module is loaded
        Import-Module ActiveDirectory -ErrorAction Stop
        
        $serverParam = @{}
        if ($srv) { $serverParam.Server = $srv }
        
        if ($act -eq 'getOUs') {
            return Get-ADOrganizationalUnit -Filter * @serverParam -Properties CanonicalName | Select-Object Name, DistinguishedName, CanonicalName
        }
        
        if ($act -eq 'search') {
            $baseParam = @{}
            if ($base) { $baseParam.SearchBase = $base }
            
            # Simple combined search for common objects
            $users = Get-ADUser -Filter $flt @baseParam @serverParam -Properties Description, Enabled, LockedOut -ErrorAction SilentlyContinue | Select-Object Name, SamAccountName, ObjectClass, Description, Enabled, LockedOut, DistinguishedName
            $groups = Get-ADGroup -Filter $flt @baseParam @serverParam -Properties Description -ErrorAction SilentlyContinue | Select-Object Name, SamAccountName, ObjectClass, Description, DistinguishedName
            $computers = Get-ADComputer -Filter $flt @baseParam @serverParam -Properties Description, Enabled -ErrorAction SilentlyContinue | Select-Object Name, SamAccountName, ObjectClass, Description, Enabled, DistinguishedName
            
            return @($users, $groups, $computers) | Where-Object { $_ -ne $null }
        }
        
        if ($act -eq 'getDetails') {
            # Retrieve full properties for a specific user
            $user = Get-ADUser -Identity $flt @serverParam -Properties Title, Department, Manager, PasswordLastSet, LockedOut, MemberOf, EmailAddress
            return $user | Select-Object *
        }
        
    } -ArgumentList $Action, $SearchBase, $Filter, $Server -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/active-directory/scripts/ad-manage.ps1
# Handles Password Resets, Unlocks, Enable/Disable, Memberships.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'resetPassword', 'unlock', 'enable', 'disable', 'addMember', 'removeMember'
    [string]$Identity, # SamAccountName or DN
    [string]$TargetGroup = "", # For membership changes
    [string]$PasswordBase64 = "",
    [string]$Server = ""
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $id, $grp, $passB64, $srv)
        Import-Module ActiveDirectory -ErrorAction Stop
        
        $serverParam = @{}
        if ($srv) { $serverParam.Server = $srv }
        
        switch ($act) {
            'resetPassword' {
                $passStr = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($passB64))
                $secStr = ConvertTo-SecureString $passStr -AsPlainText -Force
                Set-ADAccountPassword -Identity $id -NewPassword $secStr -Reset @serverParam -ErrorAction Stop
            }
            'unlock' { Unlock-ADAccount -Identity $id @serverParam -ErrorAction Stop }
            'enable' { Enable-ADAccount -Identity $id @serverParam -ErrorAction Stop }
            'disable' { Disable-ADAccount -Identity $id @serverParam -ErrorAction Stop }
            'addMember' { Add-ADGroupMember -Identity $grp -Members $id @serverParam -ErrorAction Stop }
            'removeMember' { Remove-ADGroupMember -Identity $grp -Members $id @serverParam -Confirm:$false -ErrorAction Stop }
            default { throw "Unknown action: $act" }
        }
    } -ArgumentList $Action, $Identity, $TargetGroup, $PasswordBase64, $Server -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; action = $Action } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; action = $Action; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 5. Create Plugin README

```markdown
# plugins/active-directory/README.md

# Active Directory Plugin

**ID:** `active-directory`
**Category:** System
**Priority:** P2

## Description
Web-based ADUC. Browse OUs, search objects, reset passwords, unlock accounts, and manage memberships.

## Configuration
Requires the target machine in NEXUS to have the `ActiveDirectory` PowerShell module installed (RSAT).

## Scripts
- `scripts/ad-queries.ps1` — LDAP searches and object retrieval
- `scripts/ad-manage.ps1` — State changes and password resets
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/active-directory/plugin.json` | Create | Full manifest |
| `plugins/active-directory/ui/Tool.tsx` | Create | Full AD browser page |
| `plugins/active-directory/ui/components/AdObjectDetails.tsx`| Create | Drawer for object properties |
| `plugins/active-directory/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/active-directory/scripts/ad-queries.ps1` | Create | Fetch script |
| `plugins/active-directory/scripts/ad-manage.ps1` | Create | Action script |
| `plugins/active-directory/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page correctly renders the OU tree
- [ ] Searching for `*` in an OU correctly lists Users, Groups, and Computers
- [ ] Password reset modal correctly encodes and applies the password
- [ ] Unlocking an account reflects the state change in the UI
- [ ] Modifying group membership adds/removes the user correctly in AD

---

## Notes for Coding Agent
- **Module Dependency:** The scripts rely heavily on `Import-Module ActiveDirectory`. The UI should gracefully handle the error if this module is missing on the target machine and instruct the user to install RSAT or select a Domain Controller.
- **Payload Size:** Searching AD at the root (`DC=...`) with `*` can return thousands of objects and crash the browser/WinRM. Implement limits (`-ResultSetSize 1000`) or enforce querying within specific OUs.

---

## Sub-Phase Breakdown (if needed)
- **30-0:** Plugin manifest + README + folder structure
- **30-1:** Scripts implementation
- **30-2:** UI components and state management



