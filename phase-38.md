# Phase 38 — NEXUS Exclusive Plugins Batch 1

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Develop NEXUS-exclusive capabilities that Windows Admin Center (WAC) and Central Administration do not offer natively. The first batch focuses on automated baseline comparisons across the entire server fleet.

---

## Context: What is NEXUS?
While previous phases focused on parity with existing Microsoft MMC snap-ins, Phase 38 begins introducing features unique to NEXUS. One of the biggest challenges in farm management is "configuration drift" — when one web front-end has slightly different registry keys, features, or IIS settings than the others. This plugin detects that drift.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/drift-detector/plugin.json` — plugin manifest
- Sidebar tool: Farm Drift Detector
- Functionality: Select a "Master" machine and N "Target" machines. The tool pulls registry paths, installed Windows Features, and IIS sites from all of them and highlights differences.
- Output: Visual diff viewer (similar to GitHub diff) showing missing or mismatched configurations.
- PowerShell scripts: `scripts/get-baseline.ps1`

**Out of scope:**
- Auto-remediation of drift (User must manually apply fixes based on the report)

---

## Prerequisites
- Phase 2 (WinRM/CIM)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Diff Engine | React 18, `react-diff-viewer` or custom logic |
| Data Gathering| PowerShell |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/drift-detector/plugin.json
{
  "id": "drift-detector",
  "name": "Drift Detector",
  "description": "Compare configurations across multiple machines to detect configuration drift.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "Exclusive",
  "icon": "git-merge",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "drift",
        "title": "Drift Detector",
        "icon": "git-merge",
        "component": "ui/Tool",
        "sidebar_group": "Exclusive",
        "sidebar_order": 24
      }
    ]
  },
  "permissions": { "winrm": true, "domain_admin": true, "run_scripts": true }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/drift-detector/ui/Tool.tsx
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Configuration Drift Detector                                    │
// │  Master Node: [SP-WFE01 ▼]      Targets: [SP-WFE02, SP-WFE03]    │
// ├──────────────────────────────────────────────────────────────────┤
// │  [▶ Run Comparison]                                              │
// ├──────────────────────────────────────────────────────────────────┤
// │  Differences Found:                                              │
// │  - Windows Features: SP-WFE02 is missing 'Web-ASP-Net45'         │
// │  - IIS Application Pools: SP-WFE03 is missing 'SharePoint - 80'  │
// │  - Registry (HKLM\Software\Company): Version mismatch on WFE02   │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create PowerShell Scripts

```powershell
# plugins/drift-detector/scripts/get-baseline.ps1
# Gathers a standardized JSON footprint of the machine
param([string]$ComputerName = $env:COMPUTERNAME)
# (Retrieves installed features, IIS pools, and specific registry keys, outputting a serialized snapshot)
```

### 4. Create Plugin README

Create `README.md` explaining the drift detection logic.

---

## Files to Create/Modify
- `plugins/drift-detector/plugin.json`
- `plugins/drift-detector/ui/Tool.tsx`
- `plugins/drift-detector/scripts/get-baseline.ps1`
- `plugins/drift-detector/README.md`

---

## Test Criteria
- [ ] Successfully compares two machines and correctly highlights a missing Windows Feature.

---

## Sub-Phase Breakdown (if needed)
- **38-0:** Plugin manifest + README + folder structure
- **38-1:** Scripts implementation
- **38-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.


