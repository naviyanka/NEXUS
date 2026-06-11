# Phase 25 — Certificate Manager Plugin (PKI & SSL Management)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `certificate-manager` plugin — a web-based utility for managing local machine certificates. It allows administrators to browse certificate stores, identify expiring SSL certificates, export public keys (.cer files), and delete expired certificates across managed servers without needing the `certlm.msc` MMC snap-in.

---

## Context: What is NEXUS?
Expired SSL/TLS certificates cause severe downtime for web apps, APIs, and infrastructure. Diagnosing certificate issues or auditing a machine's trust store typically requires RDPing to the server. Phase 25 integrates certificate management into NEXUS. Utilizing the PowerShell `PKI` module (specifically the `Cert:\` drive provider), NEXUS can pull certificate metadata, alert on impending expirations via the dashboard, and allow administrators to inspect certificate details natively in the browser.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/certificate-manager/plugin.json` — plugin manifest
- Sidebar tool: full-page certificate manager
- Dashboard panel: expiring certificates alert widget
- Browse Stores: navigate `LocalMachine` stores (My, Root, CA, WebHosting, etc.)
- Certificate List: subject, issuer, thumbprint, expiration date, intended purposes
- Expiry warnings: visual color-coding for certificates expiring within 30, 60, or 90 days
- Certificate Detail Drawer: full X509 details (SANs, Key Usage, Public Key algorithm, Serial Number)
- Export: download public key as Base64 encoded `.cer` file
- Delete: remove certificates from the store
- PowerShell scripts: `scripts/get-certificates.ps1`, `scripts/export-certificate.ps1`, `scripts/delete-certificate.ps1`
- Context menu contribution: "Manage Certificates" on machine cards (Phase 15)

**Out of scope:**
- Importing/installing new certificates (Requires secure private key transfer which is complex and better suited for a dedicated phase or manual provisioning)
- Active Directory Certificate Services (AD CS) CA Management
- CurrentUser certificate stores (NEXUS focuses on Machine-level administration)

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing PowerShell PKI commands remotely)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview — context menu)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Certificate retrieval | PowerShell (`Get-ChildItem -Path Cert:\LocalMachine\...`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/certificate-manager/plugin.json
{
  "id": "certificate-manager",
  "name": "Certificate Manager",
  "description": "Manage local machine certificates. Browse certificate stores, monitor expiration dates, export public keys, and delete expired certificates.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "shield-check",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "expiring-certs",
        "title": "Expiring Certificates",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 3600,
        "data_source": "api/machines"
      }
    ],
    "tools": [
      {
        "id": "certificates",
        "title": "Certificate Manager",
        "icon": "shield-check",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 11
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "certificate-manager.manage",
        "title": "Manage Certificates",
        "icon": "shield-check",
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
        "command": "certificate-manager.manage"
      }
    ],
    "settings_page": {
      "id": "certificate-manager-settings",
      "title": "Certificate Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "warning_days": {
      "type": "number",
      "default": 30,
      "label": "Days before expiration to warn"
    },
    "critical_days": {
      "type": "number",
      "default": 7,
      "label": "Days before expiration to flag as critical"
    }
  }
}
```

### 2. Create Dashboard Panel Component

```tsx
// plugins/certificate-manager/ui/Panel.tsx
//
// Shows certificates across the farm that are expiring soon.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Expiring Certificates                  [Open ↗]     │
// ├──────────────────────────────────────────────────────┤
// │  [ 2 ] Critical (< 7 Days)                           │
// │  [ 5 ] Warning  (< 30 Days)                          │
// │                                                      │
// │  Machine      │ Subject             │ Expires In     │
// │  ─────────────┼─────────────────────┼─────────────── │
// │  [X] SP-WFE01 │ CN=*.company.com    │ 2 Days         │
// │  [X] SQL01    │ CN=SQL01.domain.com │ 5 Days         │
// │  [!] DC02     │ CN=DC02.domain.com  │ 12 Days        │
// └──────────────────────────────────────────────────────┘
```

### 3. Create Sidebar Tool Component

```tsx
// plugins/certificate-manager/ui/Tool.tsx
//
// Full-page certificate manager.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Certificate Manager                                             │
// │  Target: [DC01 ▼]               Store: [Personal (My) ▼]       │
// ├──────────────────────────────────────────────────────────────────┤
// │  [Search Subject/Issuer...]     [Filter: All Valid ▼]            │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  Subject                  │ Issuer          │ Expiration │ Thumb │
// │  ─────────────────────────┼─────────────────┼────────────┼────── │
// │  CN=DC01.domain.com       │ CN=Internal-CA  │ 10/12/2026 │ 1A2B..│
// │  CN=localhost             │ CN=localhost    │ 01/01/2030 │ F4E3..│
// │  ...                                                             │
// ├──────────────────────────────────────────────────────────────────┤
// │  Selected: CN=DC01.domain.com                                    │
// │  [⬇ Export Public Key] [🗑 Delete] [Details ↗]                    │
// └──────────────────────────────────────────────────────────────────┘
```

### 4. Create Certificate Details Drawer Component

```tsx
// plugins/certificate-manager/ui/components/CertificateDetails.tsx
//
// Slide-out drawer showing full X509 certificate details.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   Certificate Details           │
// ├──────────────────────────────────────────┤
// │  Subject:       CN=DC01.domain.com       │
// │  Issuer:        CN=Internal-CA           │
// │  Valid From:    10/12/2025               │
// │  Valid To:      10/12/2026 (In 50 Days)  │
// │  Thumbprint:    1A2B3C4D5E6F7G8H9I0J     │
// │  Serial No:     01 23 45 67 89 AB CD     │
// ├──────────────────────────────────────────┤
// │  Subject Alternative Names (SANs):       │
// │  - DNS Name: DC01.domain.com             │
// │  - DNS Name: DC01                        │
// ├──────────────────────────────────────────┤
// │  Key Usage:                              │
// │  - Digital Signature, Key Encipherment   │
// ├──────────────────────────────────────────┤
// │  Enhanced Key Usage (EKU):               │
// │  - Server Authentication (1.3.6.1.5...)  │
// │  - Client Authentication (1.3.6.1.5...)  │
// ├──────────────────────────────────────────┤
// │  [⬇ Export (.cer)]                       │
// └──────────────────────────────────────────┘
```

### 5. Create PowerShell Scripts

```powershell
# plugins/certificate-manager/scripts/get-certificates.ps1
# Retrieves certificates from a specified store.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$StoreName = "My" # 'My', 'Root', 'CA', 'WebHosting', etc.
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($store)
        
        $path = "Cert:\LocalMachine\$store"
        if (-not (Test-Path $path)) {
            throw "Certificate store path not found: $path"
        }
        
        $certs = Get-ChildItem -Path $path
        
        $output = @()
        foreach ($cert in $certs) {
            # Extract basic info
            $output += @{
                Subject = $cert.Subject
                Issuer = $cert.Issuer
                Thumbprint = $cert.Thumbprint
                SerialNumber = $cert.SerialNumber
                NotBefore = $cert.NotBefore.ToString("o")
                NotAfter = $cert.NotAfter.ToString("o")
                HasPrivateKey = $cert.HasPrivateKey
                FriendlyName = $cert.FriendlyName
            }
        }
        return $output
    } -ArgumentList $StoreName -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; count = $results.Count; certificates = $results } | ConvertTo-Json -Depth 3
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/certificate-manager/scripts/export-certificate.ps1
# Exports a certificate's public key as Base64.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$StoreName = "My",
    [string]$Thumbprint
)

try {
    $base64 = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($store, $thumb)
        
        $cert = Get-Item -Path "Cert:\LocalMachine\$store\$thumb" -ErrorAction Stop
        $bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
        return [Convert]::ToBase64String($bytes, [System.Base64FormattingOptions]::InsertLineBreaks)
    } -ArgumentList $StoreName, $Thumbprint -ErrorAction Stop

    # The returned Base64 string can be saved as a .cer file directly by the browser
    $pem = "-----BEGIN CERTIFICATE-----`n$base64`n-----END CERTIFICATE-----"
    
    @{ success = $true; hostname = $ComputerName; thumbprint = $Thumbprint; pem = $pem } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; thumbprint = $Thumbprint; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/certificate-manager/scripts/delete-certificate.ps1
# Deletes a certificate by thumbprint.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$StoreName = "My",
    [string]$Thumbprint
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($store, $thumb)
        
        $path = "Cert:\LocalMachine\$store\$thumb"
        Remove-Item -Path $path -Force -ErrorAction Stop
    } -ArgumentList $StoreName, $Thumbprint -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; action = "deleted"; thumbprint = $Thumbprint } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 6. Create Plugin README

```markdown
# plugins/certificate-manager/README.md

# Certificate Manager Plugin

**ID:** `certificate-manager`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Web-based utility for managing local machine certificates. Browse stores, identify expiring SSL certificates, export public keys, and delete expired certificates.

## Contributions
- **Dashboard Panel** — Expiring certificates alert
- **Sidebar Tool** — "Certificate Manager"
- **Context Menu** — "Manage Certificates" on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `warning_days`| number | 30 | Days before expiration to warn |
| `critical_days`| number | 7 | Days before expiration to flag as critical |

## Scripts
- `scripts/get-certificates.ps1` — Queries the `Cert:\LocalMachine` provider
- `scripts/export-certificate.ps1` — Exports public key as Base64/PEM
- `scripts/delete-certificate.ps1` — Removes certificate from the store
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/certificate-manager/plugin.json` | Create | Full manifest |
| `plugins/certificate-manager/ui/Tool.tsx` | Create | Full certificate manager page |
| `plugins/certificate-manager/ui/Panel.tsx` | Create | Dashboard expiring certs panel |
| `plugins/certificate-manager/ui/components/CertificateDetails.tsx`| Create | Drawer for X509 details |
| `plugins/certificate-manager/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/certificate-manager/scripts/get-certificates.ps1` | Create | Fetch script |
| `plugins/certificate-manager/scripts/export-certificate.ps1`| Create | Export script |
| `plugins/certificate-manager/scripts/delete-certificate.ps1`| Create | Delete script |
| `plugins/certificate-manager/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page loads and queries the "My" (Personal) store by default
- [ ] Date math correctly identifies and color-codes expiring certificates (Red < 7 days, Yellow < 30 days)
- [ ] Export function correctly downloads a valid `.cer` file that Windows recognizes
- [ ] Deletion prompts for confirmation and succeeds
- [ ] Dashboard panel correctly aggregates expiring certificates across the machine list

---

## Sub-Phase Breakdown (if needed)
- **25-0:** Plugin manifest + README + folder structure
- **25-1:** `get-certificates.ps1`, `export-certificate.ps1`, `delete-certificate.ps1` script implementations
- **25-2:** UI shell: Tool page, machine selector, and store selector
- **25-3:** Certificate data table with sorting and local filtering (Subject/Issuer)
- **25-4:** Certificate Details drawer and Export action logic
- **25-5:** Expiration math logic and Dashboard panel integration
- **25-6:** Settings page and context menu integration

---

## Notes for Coding Agent
- **Certificate Dates:** Ensure UTC vs Local time conversions are handled correctly when calculating days until expiration. PowerShell `NotAfter` provides local time by default.
- **Data Serialization:** X509Certificate2 objects are deep and complex. Only serialize the necessary properties in `get-certificates.ps1` to keep the JSON payload small and prevent cyclical serialization errors. Extracting SANs and EKUs might require digging into the `Extensions` property collection of the certificate object if full details are needed, but stick to basics for the main list view.
- **Exporting Format:** The `export-certificate.ps1` script constructs a PEM format string. The frontend should create a Blob with `type: 'application/x-x509-ca-cert'` and trigger a browser download with a `.cer` extension.


