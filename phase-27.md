# Phase 27 — Registry Editor Plugin (Remote RegEdit)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `registry-editor` plugin — a web-based replacement for `regedit.exe`. It enables administrators to browse, create, edit, and delete registry keys and values remotely across managed machines, providing a fast and secure alternative to using Remote Desktop or the traditional MMC snap-in.

---

## Context: What is NEXUS?
The Windows Registry is the central configuration database for the OS and most applications. Troubleshooting software issues, changing system behaviors, or verifying configuration states almost always involves inspecting registry keys. Phase 27 brings the Registry Editor into NEXUS. Utilizing PowerShell's native registry providers (`HKLM:\`, `HKCU:\`), administrators can query and modify the registry instantly through a familiar, tree-based web interface.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/registry-editor/plugin.json` — plugin manifest
- Sidebar tool: full-page registry editor interface
- Navigation: Left-pane hierarchical tree view of registry hives (HKLM, HKCU, HKU, HKCR, HKCC)
- Data view: Right-pane list of keys and values for the selected path
- Data Types: Full support for reading/writing `String`, `ExpandString`, `DWord`, `QWord`, `MultiString`, and `Binary`
- Key Operations: New Key, Rename Key, Delete Key
- Value Operations: New Value, Edit Value, Rename Value, Delete Value
- Breadcrumb navigation and path copy/paste
- Edit Modals: Context-aware dialogs for editing different data types (e.g., decimal/hex toggle for DWords)
- PowerShell scripts: `scripts/get-registry.ps1`, `scripts/manage-registry.ps1`
- Context menu contribution: "Registry Editor" on machine cards (Phase 15)

**Out of scope:**
- Loading offline registry hives
- Exporting/Importing `.reg` files (Future enhancement)
- Modifying Registry ACLs/Permissions

---

## Prerequisites
- Phase 2 (WinRM/CIM — WinRM required for executing PowerShell registry commands remotely)
- Phase 3 (Script Executor — for running the management scripts)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Registry retrieval & management | PowerShell (`Get-ChildItem`, `Get-ItemProperty`, `Set-ItemProperty`) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/registry-editor/plugin.json
{
  "id": "registry-editor",
  "name": "Registry Editor",
  "description": "Browse and modify the Windows Registry remotely. Supports creating, editing, and deleting keys and values across all hives.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "database",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [],
    "tools": [
      {
        "id": "regedit",
        "title": "Registry Editor",
        "icon": "database",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 13
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "registry-editor.open",
        "title": "Registry Editor",
        "icon": "database",
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
        "command": "registry-editor.open"
      }
    ],
    "settings_page": {
      "id": "registry-editor-settings",
      "title": "Registry Editor Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "warn_on_delete": {
      "type": "boolean",
      "default": true,
      "label": "Prompt for confirmation before deleting keys/values"
    }
  }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/registry-editor/ui/Tool.tsx
//
// Full-page registry editor tool.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Registry Editor                                                 │
// │  Target: [DC01 ▼]                                                │
// ├──────────────────────────────────────────────────────────────────┤
// │  Path: [ HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion      ]   │
// ├─────────────┬────────────────────────────────────────────────────┤
// │  > HKCR     │ Name             │ Type         │ Data             │
// │  > HKCU     │ ─────────────────┼──────────────┼──────────────────│
// │  v HKLM     │ (Default)        │ REG_SZ       │ (value not set)  │
// │   v SOFTWARE│ CommonFilesDir   │ REG_SZ       │ C:\Program Files\│
// │    > Intel  │ InstallDate      │ REG_DWORD    │ 0x62a1b9f4 (165..│
// │    v Microso│ ProgramFilesDir  │ REG_SZ       │ C:\Program Files │
// │  > HKU      │                  │              │                  │
// │  > HKCC     │                  │              │                  │
// ├─────────────┴────────────────────────────────────────────────────┤
// │  Selected: InstallDate (REG_DWORD)                               │
// │  [✏ Edit Value] [🗑 Delete]                                      │
// └──────────────────────────────────────────────────────────────────┘
```

### 3. Create Value Editing Modals

```tsx
// plugins/registry-editor/ui/components/EditValueModal.tsx
//
// Context-aware modal for editing registry values.
// Should dynamically render inputs based on the Type (REG_SZ, REG_DWORD, etc.)
//
// Layout for REG_DWORD:
// ┌──────────────────────────────────────────┐
// │  Edit DWORD (32-bit) Value               │
// ├──────────────────────────────────────────┤
// │  Value name:                             │
// │  [ InstallDate                       ]   │
// │                                          │
// │  Value data:             Base:           │
// │  [ 1654761972        ]   (o) Hexadecimal │
// │                          (x) Decimal     │
// ├──────────────────────────────────────────┤
// │               [Cancel] [OK]              │
// └──────────────────────────────────────────┘
```

### 4. Create PowerShell Scripts

```powershell
# plugins/registry-editor/scripts/get-registry.ps1
# Retrieves subkeys and values for a given registry path.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Path = "HKLM:\"
)

try {
    $results = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($targetPath)
        
        # Ensure path uses PowerShell provider format (HKLM:\ instead of HKEY_LOCAL_MACHINE\)
        $formattedPath = $targetPath -replace "^HKEY_LOCAL_MACHINE\\|^HKLM\\", "HKLM:\" `
                                     -replace "^HKEY_CURRENT_USER\\|^HKCU\\", "HKCU:\" `
                                     -replace "^HKEY_USERS\\|^HKU\\", "HKU:\" `
                                     -replace "^HKEY_CLASSES_ROOT\\|^HKCR\\", "HKCR:\" `
                                     -replace "^HKEY_CURRENT_CONFIG\\|^HKCC\\", "HKCC:\"
                                     
        if (-not $formattedPath.Contains(":\")) {
             $formattedPath = $formattedPath -replace "\\", ":\"
        }

        $subKeys = @()
        $values = @()
        
        if (Test-Path $formattedPath) {
            # Get SubKeys
            $subKeys = Get-ChildItem -Path $formattedPath -ErrorAction SilentlyContinue | Select-Object @{N='Name';E={$_.PSChildName}}, @{N='HasSubKeys';E={$_.SubKeyCount -gt 0}}
            
            # Get Values
            $item = Get-Item -Path $formattedPath -ErrorAction SilentlyContinue
            if ($item.Property.Count -gt 0) {
                foreach ($val in $item.Property) {
                    # Handle (Default) value which is represented by empty string in PowerShell
                    $valName = if ($val -eq "") { "(Default)" } else { $val }
                    
                    try {
                        $kind = $item.GetValueKind($val)
                        $data = $item.GetValue($val)
                        
                        # Format binary data for JSON
                        if ($kind -eq 'Binary') {
                            $data = [System.BitConverter]::ToString($data) -replace "-", " "
                        }
                        
                        $values += @{
                            Name = $valName
                            Type = $kind.ToString()
                            Data = $data
                        }
                    } catch {
                         $values += @{ Name = $valName; Type = "Unknown"; Data = "(Error reading value)" }
                    }
                }
            } else {
                # Add a (Default) value placeholder if empty
                $values += @{ Name = "(Default)"; Type = "String"; Data = "(value not set)" }
            }
        } else {
            throw "Registry path not found: $formattedPath"
        }
        
        return @{ subKeys = $subKeys; values = $values }
    } -ArgumentList $Path -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; path = $Path; data = $results } | ConvertTo-Json -Depth 4
} catch {
    @{ success = $false; hostname = $ComputerName; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/registry-editor/scripts/manage-registry.ps1
# Handles Create, Edit, Rename, and Delete for keys and values.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'createKey', 'deleteKey', 'renameKey', 'setValue', 'deleteValue', 'renameValue'
    [string]$Path,
    [string]$Name = "",
    [string]$NewName = "",
    [string]$ValueData = "",
    [string]$ValueType = "String" # 'String', 'ExpandString', 'DWord', 'QWord', 'MultiString', 'Binary'
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $targetPath, $name, $newName, $data, $type)
        
        $formattedPath = $targetPath -replace "^HKLM\\", "HKLM:\" -replace "^HKCU\\", "HKCU:\"
        
        switch ($act) {
            'createKey' {
                New-Item -Path $formattedPath -Name $name -Force -ErrorAction Stop
            }
            'deleteKey' {
                Remove-Item -Path "$formattedPath\$name" -Recurse -Force -ErrorAction Stop
            }
            'renameKey' {
                Rename-Item -Path "$formattedPath\$name" -NewName $newName -ErrorAction Stop
            }
            'setValue' {
                $actualName = if ($name -eq "(Default)") { "" } else { $name }
                
                # Handle array for MultiString
                if ($type -eq 'MultiString') {
                    $data = $data -split "`n"
                }
                # Handle byte array for Binary
                if ($type -eq 'Binary') {
                    $dataStr = $data -replace "\s", ""
                    $data = [byte[]]::new($dataStr.Length / 2)
                    for($i=0; $i -lt $dataStr.Length; $i+=2) {
                        $data[$i/2] = [Convert]::ToByte($dataStr.Substring($i, 2), 16)
                    }
                }
                
                Set-ItemProperty -Path $formattedPath -Name $actualName -Value $data -Type $type -Force -ErrorAction Stop
            }
            'deleteValue' {
                $actualName = if ($name -eq "(Default)") { "" } else { $name }
                Remove-ItemProperty -Path $formattedPath -Name $actualName -Force -ErrorAction Stop
            }
            'renameValue' {
                Rename-ItemProperty -Path $formattedPath -Name $name -NewName $newName -ErrorAction Stop
            }
            default { throw "Unknown action: $act" }
        }
    } -ArgumentList $Action, $Path, $Name, $NewName, $ValueData, $ValueType -ErrorAction Stop

    @{ success = $true; hostname = $ComputerName; action = $Action } | ConvertTo-Json
} catch {
    @{ success = $false; hostname = $ComputerName; action = $Action; error = $_.Exception.Message } | ConvertTo-Json
}
```

### 5. Create Plugin README

```markdown
# plugins/registry-editor/README.md

# Registry Editor Plugin

**ID:** `registry-editor`
**Category:** System
**Priority:** P2

## Description
Web-based replacement for `regedit.exe`. Browse and modify registry keys and values securely over WinRM.

## Contributions
- **Sidebar Tool** — "Registry Editor"
- **Context Menu** — "Registry Editor" on machine cards

## Scripts
- `scripts/get-registry.ps1` — Queries keys and values
- `scripts/manage-registry.ps1` — Modifies registry state
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/registry-editor/plugin.json` | Create | Full manifest |
| `plugins/registry-editor/ui/Tool.tsx` | Create | Full registry editor page |
| `plugins/registry-editor/ui/components/EditValueModal.tsx`| Create | Modals for editing DWORD, SZ, etc. |
| `plugins/registry-editor/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/registry-editor/scripts/get-registry.ps1` | Create | Fetch script |
| `plugins/registry-editor/scripts/manage-registry.ps1` | Create | Action script |
| `plugins/registry-editor/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page correctly renders the root hives
- [ ] Expanding a hive dynamically lazy-loads its subkeys
- [ ] Clicking a key displays its values in the right pane accurately
- [ ] Editing a DWord successfully updates the value on the remote system
- [ ] Path bar allows pasting a valid path (e.g., `HKLM\SOFTWARE`) and automatically navigates there

---

## Sub-Phase Breakdown (if needed)
- **27-0:** Plugin manifest + README + folder structure
- **27-1:** `get-registry.ps1` script implementation with data type handling
- **27-2:** `manage-registry.ps1` script implementation
- **27-3:** UI shell: Split pane layout, machine selector
- **27-4:** Left Pane: Lazy-loading Tree View component
- **27-5:** Right Pane: Value data grid with formatting
- **27-6:** Edit/Create modals for various registry types

---

## Notes for Coding Agent
- **PowerShell Path formatting:** Be extremely careful about PowerShell provider paths vs standard registry paths. `HKLM\Software` must be translated to `HKLM:\Software` before querying, but standard paths should be shown in the UI.
- **The (Default) Value:** In PowerShell, the `(Default)` value of a registry key is represented by an empty string `""`. Handle this edge case in both reading and writing scripts to ensure the UI displays `(Default)` correctly instead of an empty blank row.
- **Tree View State:** Ensure the tree view remembers its expanded state when refreshing values, otherwise users will lose their place in deep registry paths.


