# Phase 33 — Defender & Security Baseline Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `defender-manager` plugin — a web interface for monitoring Windows Defender Antivirus status, triggering manual scans, and checking security baselines across the server fleet.

---

## Context: What is NEXUS?
Ransomware and malware are persistent threats to server environments. While enterprise solutions (like Microsoft Defender for Endpoint or SCCM) provide central reporting, system administrators often need to check the local AV status of a specific server during troubleshooting or provisioning. Utilizing the native `Defender` PowerShell module, Phase 33 brings this capability into NEXUS, allowing admins to ensure definitions are up-to-date and trigger emergency scans without logging into the machine.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/defender-manager/plugin.json` — plugin manifest
- Sidebar tool: Defender Status and Management dashboard
- Dashboard panel: AV Signature Status (highlights machines with out-of-date definitions)
- Status View: Real-time protection status, Engine version, Signature version, Last scan time
- Operations: Trigger Quick Scan, Trigger Full Scan, Update Signatures
- Threat History: View recently quarantined or detected threats
- PowerShell scripts: `scripts/get-defender.ps1`, `scripts/manage-defender.ps1`
- Context menu contribution: "Manage Defender" on machine cards

**Out of scope:**
- Configuring complex Attack Surface Reduction (ASR) rules
- Managing exclusions (Exclusions should ideally be managed via Group Policy, not locally per-machine)
- Integrating with third-party AV products (CrowdStrike, SentinelOne)

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 3 (Script Executor — scanning can take time and requires background execution)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Defender Operations| PowerShell (`Defender` module: `Get-MpComputerStatus`, `Start-MpScan`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` (shield, shield-alert, scan) |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/defender-manager/plugin.json
{
  "id": "defender-manager",
  "name": "Windows Defender",
  "description": "Monitor Windows Defender AV status, update signatures, and trigger remote scans.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "shield-check",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "defender-status",
        "title": "AV Signature Status",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 3600,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "defender",
        "title": "Windows Defender",
        "icon": "shield-check",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 19
      }
    ],
    "commands": [
      {
        "id": "defender.scan",
        "title": "Quick Scan",
        "icon": "search",
        "scripts": { "powershell": "scripts/manage-defender.ps1" },
        "default_script": "powershell",
        "target": "single",
        "parallel": false
      }
    ]
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true },
  "config_schema": {
    "signature_age_warning_days": {
      "type": "number",
      "default": 3,
      "label": "Days before warning about old signatures"
    }
  }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/defender-manager/ui/Tool.tsx
//
// Full-page Defender management tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Windows Defender                                                │
// │  Target: [DC01 ▼]               [↻ Update Signatures]          │
// ├──────────────────────────────────────────────────────────────────┤
// │  Protection Status:                                              │
// │  [✓] Real-Time Protection:   ON                                  │
// │  [✓] Behavior Monitor:       ON                                  │
// │  [✓] Antivirus Enabled:      ON                                  │
// │                                                                  │
// │  Definitions:                                                    │
// │  Antivirus Signature:        1.401.1234.0                        │
// │  Last Updated:               Today, 02:00 AM (Up to date)        │
// │                                                                  │
// │  Scans:                                                          │
// │  Last Quick Scan:            Yesterday, 06:00 PM                 │
// │  Last Full Scan:             10/01/2026 12:00 AM                 │
// │  [▶ Run Quick Scan] [▶ Run Full Scan]                            │
// ├──────────────────────────────────────────────────────────────────┤
// │  Recent Threats:                                                 │
// │  No active threats detected.                                     │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/defender-manager/scripts/get-defender.ps1
param([string]$ComputerName = $env:COMPUTERNAME)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        Import-Module Defender -ErrorAction SilentlyContinue
        
        $status = Get-MpComputerStatus
        $threats = Get-MpThreat | Select-Object ThreatName, Severity, Resources, ActionSuccess
        
        return @{
            RealTimeProtectionEnabled = $status.RealTimeProtectionEnabled
            AntivirusEnabled = $status.AntivirusEnabled
            BehaviorMonitorEnabled = $status.BehaviorMonitorEnabled
            AntivirusSignatureVersion = $status.AntivirusSignatureVersion
            AntivirusSignatureLastUpdated = if ($status.AntivirusSignatureLastUpdated) { $status.AntivirusSignatureLastUpdated.ToString("o") } else { $null }
            QuickScanTime = if ($status.QuickScanEndTime) { $status.QuickScanEndTime.ToString("o") } else { $null }
            FullScanTime = if ($status.FullScanEndTime) { $status.FullScanEndTime.ToString("o") } else { $null }
            Threats = $threats
        }
    } -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/defender-manager/scripts/manage-defender.ps1
param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action # 'quickscan', 'fullscan', 'update'
)
# (Implementation logic utilizing Start-MpScan and Update-MpSignature)
```

### 4. Create Plugin README

Create `README.md` explaining the `Defender` module requirements and background execution logic for scans.

---

## Files to Create/Modify
- `plugins/defender-manager/plugin.json`
- `plugins/defender-manager/ui/Tool.tsx`
- `plugins/defender-manager/ui/Panel.tsx`
- `plugins/defender-manager/scripts/get-defender.ps1`
- `plugins/defender-manager/scripts/manage-defender.ps1`
- `plugins/defender-manager/README.md`

---

## Test Criteria
- [ ] Correctly parses and displays `Get-MpComputerStatus` properties.
- [ ] Triggering a Quick Scan launches via the Phase 3 Script Executor and doesn't block the UI.
- [ ] Dashboard panel accurately identifies machines where `AntivirusSignatureLastUpdated` is older than `signature_age_warning_days`.

---

## Sub-Phase Breakdown (if needed)
- **33-0:** Plugin manifest + README + folder structure
- **33-1:** Scripts implementation
- **33-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.



