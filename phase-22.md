# Phase 22 — File Browser Plugin (Remote File System Management)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `file-browser` plugin — a web-based file explorer that allows administrators to navigate, view, and manipulate the file system on any managed machine. It supports standard operations (copy, move, delete, rename), file uploads and downloads, and a built-in text editor for modifying configuration files (like `web.config` or `.ini` files) directly in the browser without needing RDP.

---

## Context: What is NEXUS?
A core task for administrators is inspecting log files, modifying configuration files, or transferring patches to remote servers. Usually, this means RDP or mapping administrative shares (`\\DC01\c$`). Phase 22 brings this capability directly into the NEXUS web UI. By leveraging WinRM for file metadata and PowerShell for file content transfer, it provides a fast, secure, and fully auditable way to interact with remote files.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/file-browser/plugin.json` — plugin manifest
- Sidebar tool: full-page file explorer interface
- File navigation: directory tree view (sidebar) and file list (main view)
- Breadcrumb navigation for path traversal
- File operations: Create Folder, Delete, Rename, Copy, Move
- File transfer: Upload (from browser to machine) and Download (from machine to browser)
- Built-in text editor: Monaco-based editor for modifying text/config files (JSON, XML, TXT, PS1, INI)
- File properties drawer: size, creation/modification dates, attributes (Read-Only, Hidden)
- PowerShell scripts: `scripts/manage-files.ps1`, `scripts/transfer-files.ps1`
- Context menu contribution: "Browse Files" on machine cards (Phase 15)
- Support for multiple drives (C:, D:, etc.)

**Out of scope:**
- Modifying NTFS Permissions / ACLs (Future plugin or manual PowerShell)
- Streaming large media files (video/audio)
- Parallel multi-machine file operations (File Browser is strictly single-machine focused per tab)
- Drag-and-drop between two different remote machines

---

## Prerequisites
- Phase 2 (WinRM/CIM — required for directory listing and basic file ops)
- Phase 3 (Script Executor — for heavy file operations and content transfer)
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Phase 15 (Machine Overview — context menu)
- Phase 18 (Script Runner — we can reuse the Monaco Editor component for text file editing)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| File operations | PowerShell (`Get-ChildItem`, `Copy-Item`, etc.) |
| Text Editor | Monaco Editor (same as Phase 18) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` (file-type specific icons) |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/file-browser/plugin.json
{
  "id": "file-browser",
  "name": "File Browser",
  "description": "Navigate and manage the file system on any remote machine. Upload, download, edit text files, and perform standard file operations without RDP or SMB shares.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "folder-tree",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [],
    "tools": [
      {
        "id": "browser",
        "title": "File Browser",
        "icon": "folder-tree",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 8
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "file-browser.open",
        "title": "Browse Files",
        "icon": "folder-open",
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
        "command": "file-browser.open"
      }
    ],
    "settings_page": {
      "id": "file-browser-settings",
      "title": "File Browser Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": true, 
    "run_scripts": true
  },

  "config_schema": {
    "show_hidden_files": {
      "type": "boolean",
      "default": false,
      "label": "Show hidden files and folders"
    },
    "max_upload_size_mb": {
      "type": "number",
      "default": 100,
      "label": "Maximum upload file size (MB)"
    }
  }
}
```

### 2. Create Sidebar Tool Component

```tsx
// plugins/file-browser/ui/Tool.tsx
//
// Full-page file browser interface.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  File Browser                                                    │
// │  Target: [DC01 ▼]                                                │
// ├──────────────────────────────────────────────────────────────────┤
// │  [C: ▼] > Windows > System32 > drivers          [Search...]      │
// ├────────────┬─────────────────────────────────────────────────────┤
// │ 📁 C:      │ Name             │ Size    │ Modified Date          │
// │  ├ 📁 Logs │ ─────────────────┼─────────┼─────────────────────── │
// │  ├ 📁 Prog │ 📁 etc           │         │ 10/12/26 10:00 AM      │
// │  ├ 📁 User │ 📄 hosts         │ 1 KB    │ 08/01/26 02:15 PM      │
// │  └ 📁 Win  │ 📄 lmhosts.sam   │ 4 KB    │ 05/11/25 11:22 AM      │
// │            │                                                     │
// ├────────────┴─────────────────────────────────────────────────────┤
// │  Selected: hosts (1 KB)                                          │
// │  [✏ Edit] [⬇ Download] [📋 Copy] [✂ Move] [🗑 Delete]             │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Drive selector dropdown (C:, D:, etc.)
// - Left pane: Folder tree navigation (lazy-loaded)
// - Right pane: File/Folder list for the current directory
// - Breadcrumb bar for quick up-level navigation
// - Context menu on right-click for files
// - Toolbar actions dynamically update based on selection
```

### 3. Create Built-in Text Editor Component

```tsx
// plugins/file-browser/ui/components/TextEditor.tsx
//
// Monaco-based full-screen modal or drawer for editing text files.
// Re-uses Monaco from Phase 18 if possible.
//
// Features:
// - Auto-detect language based on file extension (.json, .xml, .ps1, etc.)
// - Read-only mode if the file is locked or user lacks permissions
// - "Save" button triggers a PowerShell script to overwrite the remote file
// - "Save As" option to write to a new path
// - Warns if attempting to open files > 2MB to prevent browser lockup
```

### 4. Create File Properties Drawer Component

```tsx
// plugins/file-browser/ui/components/FileProperties.tsx
//
// Slide-out drawer showing file/folder metadata.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   hosts                         │
// ├──────────────────────────────────────────┤
// │  Type:          File                     │
// │  Path:          C:\Windows\System32\d..  │
// │  Size:          824 bytes                │
// │  Created:       11/12/2024 10:00 AM      │
// │  Modified:      08/01/2026 02:15 PM      │
// │  Accessed:      10/10/2026 09:00 AM      │
// ├──────────────────────────────────────────┤
// │  Attributes:                             │
// │  [ ] Read-Only   [ ] Hidden              │
// │  [ ] System      [X] Archive             │
// ├──────────────────────────────────────────┤
// │  [⬇ Download] [✏ Edit]                   │
// └──────────────────────────────────────────┘
```

### 5. Create PowerShell Scripts

```powershell
# plugins/file-browser/scripts/manage-files.ps1
# Handles listing directories, drives, deleting, and renaming.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action = "list", # 'list', 'drives', 'delete', 'rename', 'mkdir'
    [string]$Path = "C:\",
    [string]$NewName = "",
    [switch]$ShowHidden
)

try {
    $results = @{}
    
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $targetPath, $newNameArg, $hidden)
        
        if ($act -eq 'drives') {
            return Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, Size, FreeSpace
        }
        
        if ($act -eq 'list') {
            $forceFlag = if ($hidden) { $true } else { $false }
            return Get-ChildItem -Path $targetPath -Force:$forceFlag | Select-Object Name, FullName, Length, CreationTime, LastWriteTime, Attributes, @{N='IsContainer';E={$_.PSIsContainer}}
        }
        
        if ($act -eq 'delete') {
            Remove-Item -Path $targetPath -Recurse -Force -ErrorAction Stop
            return $true
        }
        
        if ($act -eq 'rename') {
            Rename-Item -Path $targetPath -NewName $newNameArg -ErrorAction Stop
            return $true
        }
        
        if ($act -eq 'mkdir') {
            New-Item -Path $targetPath -ItemType Directory -ErrorAction Stop
            return $true
        }
    } -ArgumentList $Action, $Path, $NewName, $ShowHidden.IsPresent | Out-Null
    # Output formatting omitted for brevity, ensure returning structured JSON.
} catch {
    @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
}
```

```powershell
# plugins/file-browser/scripts/transfer-files.ps1
# Handles reading/writing file contents for the text editor and small transfers.
# For large binaries, this uses Base64 encoding over WinRM.

param(
    [string]$ComputerName = $env:COMPUTERNAME,
    [string]$Action, # 'read', 'write'
    [string]$Path,
    [string]$Base64Content = ""
)

try {
    > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -ComputerName $ComputerName -ScriptBlock {
        param($act, $targetPath, $content)
        
        if ($act -eq 'read') {
            $bytes = [System.IO.File]::ReadAllBytes($targetPath)
            return [Convert]::ToBase64String($bytes)
        }
        
        if ($act -eq 'write') {
            $bytes = [Convert]::FromBase64String($content)
            [System.IO.File]::WriteAllBytes($targetPath, $bytes)
            return $true
        }
    } -ArgumentList $Action, $Path, $Base64Content
    # Output formatted as JSON
} catch {
    # Error handling
}
```

### 6. Create Plugin README

```markdown
# plugins/file-browser/README.md

# File Browser Plugin

**ID:** `file-browser`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Web-based remote file system explorer. Browse drives, upload/download files, and edit text configuration files directly in the browser.

## Contributions
- **Sidebar Tool** — "File Browser" for full file management
- **Context Menu** — "Browse Files" on machine cards

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `show_hidden_files` | boolean | false | Display hidden/system files |
| `max_upload_size_mb` | number | 100 | Limit base64 upload size to prevent WinRM timeout |

## Scripts
- `scripts/manage-files.ps1` — Directory listing and standard operations
- `scripts/transfer-files.ps1` — Base64 file content reading and writing
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/file-browser/plugin.json` | Create | Full manifest |
| `plugins/file-browser/ui/Tool.tsx` | Create | Full file browser page |
| `plugins/file-browser/ui/components/TextEditor.tsx` | Create | Monaco integration for file editing |
| `plugins/file-browser/ui/components/FileProperties.tsx` | Create | Drawer for file metadata |
| `plugins/file-browser/ui/Settings.tsx` | Create | Plugin settings |
| `plugins/file-browser/scripts/manage-files.ps1` | Create | List/Delete/Rename script |
| `plugins/file-browser/scripts/transfer-files.ps1`| Create | Read/Write file contents script |
| `plugins/file-browser/README.md` | Create | Plugin documentation |

---

## Test Criteria
- [ ] Plugin manifest validates
- [ ] Tool page loads and queries available drives on the target machine
- [ ] Left pane correctly lazy-loads subdirectories upon expansion
- [ ] Breadcrumb updates correctly and allows clicking to go up a level
- [ ] File size and dates format correctly according to user locale
- [ ] Text editor opens successfully for `.txt` or `.json` files and saves changes to remote disk
- [ ] Deleting a file prompts for confirmation and removes it from UI
- [ ] Creating a new folder works and appears immediately in the list
- [ ] File download correctly decodes Base64 and triggers browser download

---

## Sub-Phase Breakdown (if needed)
- **22-0:** Plugin manifest + README + folder structure
- **22-1:** `manage-files.ps1` and `transfer-files.ps1` scripts implementation
- **22-2:** UI shell: Tool page, machine selector, and drive selector
- **22-3:** File List and Directory Tree components (navigation logic)
- **22-4:** Context menus and File Operations (Delete, Rename, Mkdir)
- **22-5:** Text Editor integration (Monaco) and File Transfer logic
- **22-6:** File Properties drawer and Settings page

---

## Notes for Coding Agent
- **File Transfer Limits:** WinRM has payload limits. Transferring large files via Base64 string encoding inside a PowerShell script is inefficient and will fail for very large files. Enforce the `max_upload_size_mb` strictly in the UI. 
- **Encoding:** When reading text files for the editor, ensure UTF-8 encoding is handled properly to avoid messing up configuration files containing special characters.
- **Path Handling:** Windows paths use backslashes `\`. Ensure paths are joined and escaped correctly before passing them to PowerShell scripts.
- **Safety:** Do NOT allow editing of binary files (like `.exe` or `.dll`) in the text editor. Check file extensions before enabling the "Edit" button.


