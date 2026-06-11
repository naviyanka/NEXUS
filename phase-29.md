# Phase 29 — Network, Roles & Storage Plugins (System Settings)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build three core system plugins: `network-manager`, `roles-features`, and `storage-manager`. These replicate the essential Server Manager functionalities, allowing administrators to configure IP addresses, install Windows Server features, and manage disk volumes entirely from the browser.

---

## Context: What is NEXUS?
When provisioning a new server or expanding a farm, administrators typically need to set static IPs, add disks, and install roles like IIS. Windows Admin Center (WAC) covers these well. NEXUS aims to achieve parity with WAC. Phase 29 bundles these three related but distinct system management capabilities into separate plugins, utilizing their respective PowerShell modules.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- Three distinct plugin manifests: `network-manager`, `roles-features`, `storage-manager`
- **Network Manager Tool:**
  - View Network Adapters (Status, MAC, IPv4/IPv6, Link Speed)
  - Configure IPv4 (DHCP vs Static IP, Subnet, Gateway)
  - Configure DNS Servers
- **Roles & Features Tool:**
  - Hierarchical tree view of all Windows Roles and Features
  - Status indicators (Installed, Available, Removed)
  - Install/Uninstall functionality via `Install-WindowsFeature`
- **Storage Manager Tool:**
  - View physical disks, partitions, and volumes
  - Initialize disks, create new volumes, format with NTFS/ReFS
  - Resize/Extend existing volumes
- PowerShell scripts for each domain
- Context menu contributions for all three tools on machine cards

**Out of scope:**
- Advanced NIC Teaming configuration
- Storage Spaces Direct (S2D) or clustering configuration
- Removing feature payloads (`Uninstall-WindowsFeature -Remove`)

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing configuration commands)
- Phase 3 (Script Executor — installing features and formatting disks are long-running tasks that require background execution)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifests | `plugin.json` (Phase 6 schema) |
| Network | PowerShell (`NetAdapter`, `NetTCPIP`) |
| Roles | PowerShell (`ServerManager`) |
| Storage | PowerShell (`Storage`) |
| UI components | React 18 + TypeScript |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifests (Example: Network Manager)

```json
// plugins/network-manager/plugin.json
{
  "id": "network-manager",
  "name": "Network Manager",
  "description": "Manage network adapters, IP addresses, and DNS settings.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "network",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "network",
        "title": "Network",
        "icon": "network",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 15
      }
    ],
    "commands": [
      {
        "id": "network-manager.manage",
        "title": "Manage Network",
        "icon": "network",
        "scripts": {},
        "default_script": "powershell",
        "target": "single",
        "parallel": false
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "network-manager.manage"
      }
    ]
  },
  "permissions": { "winrm": true, "run_scripts": true }
}
```
*(Repeat similar structures for `roles-features` and `storage-manager`)*

### 2. Create UI Components

**Network Manager UI:**
- A list of adapters on the left.
- Details pane on the right showing IP config.
- "Edit IPv4" modal allowing switching between DHCP and Manual, with inputs for IP, Subnet Prefix, Gateway, and Preferred/Alternate DNS.

**Roles & Features UI:**
- A searchable Tree View listing roles (e.g., "Web Server (IIS)") with checkboxes.
- A fixed bottom bar that appears when changes are detected: `[ 2 features selected for install ] [Apply Changes]`.
- Triggering "Apply" sends the list to the Script Executor and shows a progress bar.

**Storage Manager UI:**
- A top table showing Physical Disks (Health, Size, Bus Type).
- A bottom table showing Volumes (Drive Letter, File System, Capacity, Free Space).
- Modals for "Format Volume" and "Extend Volume".

### 3. Create PowerShell Scripts

#### Network Manager Example
```powershell
# plugins/network-manager/scripts/get-adapters.ps1
param([string]$ComputerName = $env:COMPUTERNAME)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        $adapters = Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, MacAddress, LinkSpeed
        $ipconfig = Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address, IPv4DefaultGateway, DNSServer
        # Merge data logic here...
        return $mergedData
    } -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; adapters = $results } | ConvertTo-Json
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

#### Roles & Features Example
```powershell
# plugins/roles-features/scripts/get-features.ps1
param([string]$ComputerName = $env:COMPUTERNAME)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        Get-WindowsFeature | Select-Object Name, DisplayName, Description, Installed, InstallState, FeatureType, Parent
    } -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; features = $results } | ConvertTo-Json
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

#### Storage Manager Example
```powershell
# plugins/storage-manager/scripts/get-storage.ps1
param([string]$ComputerName = $env:COMPUTERNAME)
try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        $disks = Get-Disk | Select-Object Number, FriendlyName, OperationalStatus, Size, PartitionStyle
        $volumes = Get-Volume | Select-Object DriveLetter, FileSystemLabel, FileSystem, Size, SizeRemaining, HealthStatus
        return @{ disks = $disks; volumes = $volumes }
    } -ErrorAction Stop
    @{ success = $true; hostname = $ComputerName; data = $results } | ConvertTo-Json
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 4. Create Plugin READMEs

Create a standard `README.md` in each of the three plugin directories explaining their distinct purposes, categories, and scripts.

---

## Files to Create/Modify

*(This phase generates files across three plugin directories)*

| File | Action | Notes |
|------|--------|-------|
| `plugins/network-manager/*` | Create | Manifest, UI, and `NetTCPIP` scripts |
| `plugins/roles-features/*` | Create | Manifest, TreeView UI, and `ServerManager` scripts |
| `plugins/storage-manager/*` | Create | Manifest, Disk/Volume UI, and `Storage` scripts |

---

## Test Criteria
- [ ] Network: Can successfully change an adapter from DHCP to a Static IP address.
- [ ] Roles: Installing a lightweight feature (e.g., Telnet Client) succeeds via the background task executor.
- [ ] Roles: The Tree View accurately reflects parent-child dependencies (e.g., checking IIS checks required sub-features).
- [ ] Storage: Volumes are accurately reported with correct GB/TB conversions for free space.

---

## Sub-Phase Breakdown (if needed)
- **29-0:** Scaffolding all three plugin folders and manifests
- **29-1:** Network Manager implementation (UI + Scripts)
- **29-2:** Roles & Features implementation (UI + Scripts + Task integration)
- **29-3:** Storage Manager implementation (UI + Scripts)

---

## Notes for Coding Agent
- **Risk of Disconnection:** When configuring Network settings remotely via WinRM, changing the IP address of the adapter you are currently connected through will drop the connection. The UI should warn the user about this before applying changes.
- **Roles Dependencies:** `Install-WindowsFeature` has an `-IncludeManagementTools` switch. Determine via UI checkbox whether the user wants RSAT tools installed alongside the role.
- **Storage Conversion:** PowerShell `Size` properties are in bytes. Convert these to GB/TB in the PowerShell script before returning JSON to simplify the React frontend.


