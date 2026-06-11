# Phase 28 — Local Users & Groups Plugin (SAM Management)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `local-users-groups` plugin — a web interface for managing the local Security Accounts Manager (SAM) database on target machines. It allows administrators to view, create, and delete local user accounts and groups, reset passwords, and manage group memberships.

---

## Context: What is NEXUS?
Managing local administrators across a server fleet is a critical security requirement. While Active Directory handles domain accounts, local accounts (`.\Administrator`) and local groups (`Administrators`, `IIS_IUSRS`) must still be monitored and managed per machine. Using the `LocalAccounts` PowerShell module, Phase 28 brings local SAM management into NEXUS, replacing the `lusrmgr.msc` MMC snap-in and allowing instant auditing of local admins.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/local-users-groups/plugin.json` — plugin manifest
- Sidebar tool: Tabbed interface for "Users" and "Groups"
- Dashboard panel: Local Admin Audit (highlights unauthorized accounts in the Administrators group)
- Users List: Name, Full Name, Description, Enabled status, Last Logon
- Groups List: Name, Description
- User Operations: Create User, Delete User, Enable/Disable, Reset Password
- Group Operations: Create Group, Delete Group, Edit Members
- Group Membership Dialog: Add/Remove AD users, AD groups, or local users to a local group
- PowerShell scripts: `scripts/get-local-accounts.ps1`, `scripts/manage-local-accounts.ps1`
- Context menu contribution: "Manage Local Users" on machine cards

**Out of scope:**
- Active Directory Users and Computers (ADUC) management (Handled in Phase 30)
- Local Security Policy (User Rights Assignment)

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing `LocalAccounts` commands)
- Phase 3 (Script Executor — for running the management scripts)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Account retrieval & management | PowerShell (`Get-LocalUser`, `Get-LocalGroup`, `Add-LocalGroupMember`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/local-users-groups/plugin.json
{
  "id": "local-users-groups",
  "name": "Local Users & Groups",
  "description": "Manage local SAM accounts and groups. Reset passwords, audit local administrators, and modify group memberships.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "users",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "local-admin-audit",
        "title": "Local Admin Audit",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 3600,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "lusrmgr",
        "title": "Local Users & Groups",
        "icon": "users",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 14
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "local-users.manage",
        "title": "Manage Local Users",
        "icon": "users",
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
        "command": "local-users.manage"
      }
    ],
    "settings_page": {
      "id": "local-users-settings",
      "title": "Local Users Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "expected_admins": {
      "type": "string",
      "default": "Administrator, Domain Admins",
      "label": "Comma-separated list of expected local admins for auditing"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/local-users-groups/ui/Panel.tsx
//
// Shows machines that have unauthorized users in the local Administrators group.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Local Admin Audit                      [Open ↗]     │
// ├──────────────────────────────────────────────────────┤
// │  Expected Admins: Administrator, Domain Admins       │
// │                                                      │
// │  Machines with Unauthorized Admins:                  │
// │  [!] DC02:      jdoe (Domain User)                   │
// │  [!] SP-WFE01:  test_admin (Local User)              │
// │  [!] SQL01:     MSSQL_SVC (Local User)               │
// └──────────────────────────────────────────────────────┘
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/local-users-groups/ui/Tool.tsx
//
// Full-page management tool with tabs for Users and Groups.
//
// Layout (Users Tab):
// ┌──────────────────────────────────────────────────────────────────┐
// │  Local Users & Groups                                            │
// │  Target: [DC01 ▼]               [+ New User]                   │
// ├──────────────────────────────────────────────────────────────────┤
// │  [ Users ]  [ Groups ]                                           │
// ├──────────────────────────────────────────────────────────────────┤
// │  Name            │ Full Name      │ Enabled │ Description        │
// │  ────────────────┼────────────────┼─────────┼────────────────────│
// │  Administrator   │                │ Yes     │ Built-in account.. │
// │  Guest           │                │ No      │ Built-in account.. │
// │  DefaultAccount  │                │ No      │ A user account...  │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: Administrator                                         │
// │  [⊘ Disable] [🔑 Reset Password] [🗑 Delete]                      │
// └──────────────────────────────────────────────────────────────────┘
//
// Layout (Groups Tab):
// ┌──────────────────────────────────────────────────────────────────┐
// │  Local Users & Groups                                            │
// │  Target: [DC01 ▼]               [+ New Group]                  │
// ├──────────────────────────────────────────────────────────────────┤
// │  [ Users ]  [ Groups ]                                           │
// ├──────────────────────────────────────────────────────────────────┤
// │  Name            │ Description                                   │
// │  ────────────────┼────────────────────────────────────────────── │
// │  Administrators  │ Administrators have complete and unrestrict.. │
// │  Backup Operators│ Backup Operators can override security rest.. │
// │  IIS_IUSRS       │ Built-in group used by Internet Information.. │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: Administrators (Members: Administrator, Domain Admins)│
// │  [👥 Edit Members] [🗑 Delete]                                    │
// └──────────────────────────────────────────────────────────────────┘
```

### 4. Create Group Membership Dialog Component

```tsx
// plugins/local-users-groups/ui/components/GroupMembersModal.tsx
//
// Modal for adding/removing members from a local group.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  Edit Members: Administrators            │
// ├──────────────────────────────────────────┤
// │  Current Members:                        │
// │  - DC01\Administrator         [🗑]       │
// │  - DOMAIN\Domain Admins       [🗑]       │
// ├──────────────────────────────────────────┤
// │  Add Member:                             │
// │  [ DOMAIN\jdoe                      ] [+]│
// │  (Format: DOMAIN\User or Machine\User)   │
// ├──────────────────────────────────────────┤
// │               [Cancel] [Save Changes]    │
// └──────────────────────────────────────────┘
```

### 5. Create PowerShell Scripts

```powershell
# plugins/local-users-groups/scripts/get-local-accounts.ps1
# Retrieves local users, groups, and membership info.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action = "both" # 'users', 'groups', 'both', 'members'
    [string]$GroupName = ""
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $grpName)
        
        $output = @{}
        
        if ($act -in @('users', 'both')) {
            $users = Get-LocalUser | Select-Object Name, FullName, Description, Enabled, LastLogon, PrincipalSource
            $output.users = $users
        }
        
        if ($act -in @('groups', 'both')) {
            $groups = Get-LocalGroup | Select-Object Name, Description, PrincipalSource
            $output.groups = $groups
        }
        
        if ($act -eq 'members' -and $grpName) {
            $members = Get-LocalGroupMember -Group $grpName | Select-Object Name, PrincipalSource, ObjectClass
            $output.members = $members
        }
        
        return $output
    } -ArgumentList $Action, $GroupName -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/local-users-groups/scripts/manage-local-accounts.ps1
# Handles Create, Delete, Password Reset, and Membership changes.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'createUser', 'deleteUser', 'resetPassword', 'enableUser', 'disableUser', 'addMember', 'removeMember'
    [string]$TargetName, # Username or Groupname
    [string]$MemberName = "", # For membership changes
    [string]$PasswordBase64 = "" # For password resets
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $target, $member, $passB64)
        
        switch ($act) {
            'resetPassword' {
                $passStr = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($passB64))
                $secStr = ConvertTo-SecureString $passStr -AsPlainText -Force
                Set-LocalUser -Name $target -Password $secStr -ErrorAction Stop
            }
            'enableUser' { Enable-LocalUser -Name $target -ErrorAction Stop }
            'disableUser' { Disable-LocalUser -Name $target -ErrorAction Stop }
            'deleteUser' { Remove-LocalUser -Name $target -ErrorAction Stop }
            'addMember' { Add-LocalGroupMember -Group $target -Member $member -ErrorAction Stop }
            'removeMember' { Remove-LocalGroupMember -Group $target -Member $member -ErrorAction Stop }
            # create handling omitted for brevity, but follows similar pattern
            default { throw "Unknown action: $act" }
        }
    } -ArgumentList $Action, $TargetName, $MemberName, $PasswordBase64 -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; action = $Action } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; action = $Action; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 6. Create Plugin README

```markdown
# plugins/local-users-groups/README.md

# Local Users & Groups Plugin

**ID:** `local-users-groups`
**Category:** System
**Priority:** P2

## Description
Manage local SAM accounts and groups securely. Reset passwords and audit local administrators across the fleet.

## Contributions
- **Dashboard Panel** — Local Admin Audit
- **Sidebar Tool** — "Local Users & Groups"
- **Context Menu** — "Manage Local Users"

## Scripts
- `scripts/get-local-accounts.ps1` — Queries the `LocalAccounts` module
- `scripts/manage-local-accounts.ps1` — Handles state and membership changes
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/local-users-groups/plugin.json` | Create | Full manifest |
| `plugins/local-users-groups/ui/Tool.tsx` | Create | Full management page |
| `plugins/local-users-groups/ui/Panel.tsx` | Create | Dashboard audit panel |
| `plugins/local-users-groups/ui/components/GroupMembersModal.tsx`| Create | Modals for editing memberships |
| `plugins/local-users-groups/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/local-users-groups/scripts/get-local-accounts.ps1` | Create | Fetch script |
| `plugins/local-users-groups/scripts/manage-local-accounts.ps1` | Create | Action script |
| `plugins/local-users-groups/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page correctly renders both Users and Groups tabs
- [ ] Selecting a group fetches and displays its current members accurately
- [ ] Adding a domain user to a local group succeeds and reflects in the UI
- [ ] Disabling a local user correctly toggles the icon/status
- [ ] The dashboard audit panel correctly flags a machine if an unexpected user is added to the local Administrators group

---

## Sub-Phase Breakdown (if needed)
- **28-0:** Plugin manifest + README + folder structure
- **28-1:** `get-local-accounts.ps1` script implementation
- **28-2:** `manage-local-accounts.ps1` script implementation
- **28-3:** UI shell: Tabs for Users/Groups
- **28-4:** Users data table and password reset modal
- **28-5:** Groups data table and membership editing modal
- **28-6:** Dashboard panel audit logic

---

## Notes for Coding Agent
- **Passwords:** NEVER send passwords as plain text in the JSON payload or command line arguments where they could be logged. The script template uses Base64 encoding for transit, but consider utilizing Phase 8 (Credentials Manager) to handle secure string passing if possible.
- **Built-in Accounts:** Windows prevents deleting or renaming built-in accounts (Administrator, Guest). Ensure the UI hides the "Delete" button for these specific SIDs/Names to prevent unnecessary error messages.


