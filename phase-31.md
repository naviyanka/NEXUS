# Phase 31 — DNS Manager Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `dns-manager` plugin — a web interface for managing Windows Server DNS. It allows administrators to view Forward and Reverse lookup zones, and create, edit, or delete DNS records (A, CNAME, TXT, MX, SRV) directly from the browser.

---

## Context: What is NEXUS?
Updating DNS records is a frequent task during server migrations, deployments, or troubleshooting. NEXUS replaces the `dnsmgmt.msc` MMC snap-in, utilizing the `DnsServer` PowerShell module to provide a fast, centralized way to modify records across the environment without RDP.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/dns-manager/plugin.json` — plugin manifest
- Sidebar tool: full-page DNS manager
- Zones List: View Forward and Reverse lookup zones
- Records List: View all records within a selected zone
- Record Operations: Create, Edit, Delete (A, AAAA, CNAME, TXT, MX, PTR, SRV)
- PowerShell scripts: `scripts/get-dns.ps1`, `scripts/manage-dns.ps1`

**Out of scope:**
- DNSSEC configuration
- Creating new Zones (Zone creation is complex; focus is on Record management)
- Conditional Forwarders and Root Hints

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 3 (Script Executor)
- A managed machine that has the Windows DNS Server role installed.

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| DNS Operations | PowerShell (`DnsServer` module: `Get-DnsServerZone`, `Get-DnsServerResourceRecord`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/dns-manager/plugin.json
{
  "id": "dns-manager",
  "name": "DNS Manager",
  "description": "Manage Windows Server DNS Zones and Records. Create, edit, and delete A, CNAME, and TXT records.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "globe",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "dns",
        "title": "DNS Manager",
        "icon": "globe",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 17
      }
    ],
    "commands": [],
    "settings_page": {
      "id": "dns-manager-settings",
      "title": "DNS Settings",
      "component": "ui/Settings"
    }
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/dns-manager/ui/Tool.tsx
//
// Full-page DNS management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  DNS Manager                                                     │
// │  Target: [DC01 ▼]               [+ New Record]                 │
// ├─────────────┬────────────────────────────────────────────────────┤
// │  > Forward  │ Name             │ Type   │ Data                   │
// │   domain.loc│ ─────────────────┼────────┼────────────────────────│
// │   dev.local │ (same as parent) │ SOA    │ [10], dc01.domain.loc..│
// │  > Reverse  │ dc01             │ A      │ 192.168.1.10           │
// │             │ www              │ CNAME  │ web01.domain.local.    │
// │             │ _sip._tls        │ SRV    │ [0][0][443] sip.dom..  │
// ├─────────────┴────────────────────────────────────────────────────┤
// │  Selected: www (CNAME)                                           │
// │  [✏ Edit] [🗑 Delete]                                             │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/dns-manager/scripts/get-dns.ps1
param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action = "zones", # 'zones', 'records'
    [string]$ZoneName = ""
)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $zone)
        Import-Module DnsServer -ErrorAction Stop
        
        if ($act -eq 'zones') {
            return Get-DnsServerZone | Select-Object ZoneName, ZoneType, IsReverseLookupZone
        }
        if ($act -eq 'records' -and $zone) {
            # Getting RecordData as string requires mapping the specific RecordData property
            $records = Get-DnsServerResourceRecord -ZoneName $zone | Select-Object HostName, RecordType, RecordData, Timestamp, TimeToLive
            $output = @()
            foreach($r in $records) {
                # PowerShell DnsServer module returns complex objects for RecordData.
                # E.g., for A record, $r.RecordData.IPv4Address.IPAddressToString
                $dataStr = if ($r.RecordType -eq 'A') { $r.RecordData.IPv4Address.IPAddressToString }
                           elseif ($r.RecordType -eq 'CNAME') { $r.RecordData.HostNameAlias }
                           elseif ($r.RecordType -eq 'TXT') { $r.RecordData.DescriptiveText }
                           else { $r.RecordData.ToString() }
                
                $output += @{ HostName = $r.HostName; Type = $r.RecordType; Data = $dataStr; TTL = $r.TimeToLive.ToString() }
            }
            return $output
        }
    } -ArgumentList $Action, $ZoneName -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/dns-manager/scripts/manage-dns.ps1
param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'create', 'delete' (edit is usually delete + create in PS for DNS)
    [string]$ZoneName,
    [string]$HostName,
    [string]$RecordType,
    [string]$RecordData
)
# (Implementation logic utilizing Add-DnsServerResourceRecordA, Add-DnsServerResourceRecordCName, etc.)
```

### 4. Create Plugin README

Create `README.md` explaining the `DnsServer` module requirement.

---

## Files to Create/Modify
- `plugins/dns-manager/plugin.json`
- `plugins/dns-manager/ui/Tool.tsx`
- `plugins/dns-manager/ui/components/RecordModal.tsx`
- `plugins/dns-manager/scripts/get-dns.ps1`
- `plugins/dns-manager/scripts/manage-dns.ps1`
- `plugins/dns-manager/README.md`

---

## Test Criteria
- [ ] Properly handles extracting IPv4 strings from A record data objects.
- [ ] Creating a CNAME works and immediately appears in the list.
- [ ] Zones are split correctly between Forward and Reverse in the UI tree.

---

## Sub-Phase Breakdown (if needed)
- **31-0:** Plugin manifest + README + folder structure
- **31-1:** Scripts implementation
- **31-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.



