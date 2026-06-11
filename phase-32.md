# Phase 32 — DHCP Manager Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `dhcp-manager` plugin — a web interface for managing Windows Server DHCP. It allows administrators to view DHCP scopes, check active leases, and manage IP reservations.

---

## Context: What is NEXUS?
Tracking down which device has a specific IP, or reserving an IP for a new printer/server, requires checking DHCP. NEXUS replaces `dhcpmgmt.msc` by utilizing the `DhcpServer` PowerShell module, enabling fast IP lookups and reservation management natively in the browser.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/dhcp-manager/plugin.json` — plugin manifest
- Sidebar tool: full-page DHCP manager
- Scopes List: View IPv4 scopes, subnet masks, and state (Active/Inactive)
- Leases List: View active client leases (IP, MAC Address, Hostname, Lease Expiry)
- Reservations List: View, create, and delete IP reservations
- PowerShell scripts: `scripts/get-dhcp.ps1`, `scripts/manage-dhcp.ps1`

**Out of scope:**
- IPv6 DHCP Scopes
- DHCP Failover topology configuration
- Modifying Server/Scope Options (e.g., changing the default gateway for a scope - though a future enhancement)

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 3 (Script Executor)
- A managed machine that has the Windows DHCP Server role installed.

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| DHCP Operations | PowerShell (`DhcpServer` module: `Get-DhcpServerv4Scope`, `Get-DhcpServerv4Lease`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/dhcp-manager/plugin.json
{
  "id": "dhcp-manager",
  "name": "DHCP Manager",
  "description": "Manage Windows Server DHCP Scopes, Leases, and Reservations.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "network",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "dhcp",
        "title": "DHCP Manager",
        "icon": "server",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 18
      }
    ],
    "commands": [],
    "settings_page": {
      "id": "dhcp-manager-settings",
      "title": "DHCP Settings",
      "component": "ui/Settings"
    }
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/dhcp-manager/ui/Tool.tsx
//
// Full-page DHCP management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  DHCP Manager                                                    │
// │  Target: [DHCP01 ▼]             [+ New Reservation]            │
// ├─────────────┬────────────────────────────────────────────────────┤
// │  v IPv4     │ IP Address       │ Name           │ MAC Address    │
// │   > Scope1  │ ─────────────────┼────────────────┼────────────────│
// │   > Scope2  │ 192.168.1.50     │ workstation1   │ 00-1A-2B-..    │
// │             │ 192.168.1.51     │ print-server   │ A1-B2-C3-..    │
// │             │                                                    │
// ├─────────────┴────────────────────────────────────────────────────┤
// │  Selected: 192.168.1.51 (print-server)                           │
// │  [🔒 Convert to Reservation] [🗑 Delete Lease]                    │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/dhcp-manager/scripts/get-dhcp.ps1
param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action = "scopes", # 'scopes', 'leases'
    [string]$ScopeId = ""
)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $scopeId)
        Import-Module DhcpServer -ErrorAction Stop
        
        if ($act -eq 'scopes') {
            return Get-DhcpServerv4Scope | Select-Object ScopeId, Name, SubnetMask, State
        }
        if ($act -eq 'leases' -and $scopeId) {
            $leases = Get-DhcpServerv4Lease -ScopeId $scopeId | Select-Object IPAddress, HostName, ClientId, AddressState, LeaseExpiryTime
            $output = @()
            foreach($l in $leases) {
                $output += @{ 
                    IPAddress = $l.IPAddress.IPAddressToString; 
                    HostName = $l.HostName; 
                    MAC = $l.ClientId; 
                    State = $l.AddressState; 
                    Expiry = if ($l.LeaseExpiryTime) { $l.LeaseExpiryTime.ToString("o") } else { "Reservation" } 
                }
            }
            return $output
        }
    } -ArgumentList $Action, $ScopeId -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/dhcp-manager/scripts/manage-dhcp.ps1
param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'createReservation', 'deleteLease', 'deleteReservation'
    [string]$ScopeId,
    [string]$IPAddress,
    [string]$MACAddress = "",
    [string]$Name = ""
)
# (Implementation logic utilizing Add-DhcpServerv4Reservation, Remove-DhcpServerv4Lease, etc.)
```

### 4. Create Plugin README

Create `README.md` explaining the `DhcpServer` module requirement.

---

## Files to Create/Modify
- `plugins/dhcp-manager/plugin.json`
- `plugins/dhcp-manager/ui/Tool.tsx`
- `plugins/dhcp-manager/ui/components/ReservationModal.tsx`
- `plugins/dhcp-manager/scripts/get-dhcp.ps1`
- `plugins/dhcp-manager/scripts/manage-dhcp.ps1`
- `plugins/dhcp-manager/README.md`

---

## Test Criteria
- [ ] Accurately lists IPv4 scopes with their subnet masks.
- [ ] Correctly translates ClientId to a readable MAC Address format.
- [ ] Converting an active lease into a reservation works via the script.

---

## Sub-Phase Breakdown (if needed)
- **32-0:** Plugin manifest + README + folder structure
- **32-1:** Scripts implementation
- **32-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.



