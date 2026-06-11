# Phase 18 — Script Runner & Library Plugin (Ad-Hoc Execution + Saved Scripts)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build two tightly integrated plugins: `script-runner` (execute ad-hoc PowerShell/Python/Batch/VBS scripts on target machines) and `script-library` (save, browse, tag, and reuse scripts). Together they form the scripting backbone of NEXUS — the feature that makes "run anything on any machine in one click" possible. The runner provides a code editor with syntax highlighting, target selector, and live output. The library provides persistent storage, categorization, and one-click re-execution of saved scripts. These are P1-Core NEXUS-exclusive plugins that no WAC equivalent offers.

---

## Context: What is NEXUS?
NEXUS's killer feature is multi-machine scripting. Phase 3 built the `ScriptExecutor` backend — the engine that runs PS/Python/Batch/VBS scripts on remote machines via WinRM with parallel execution. Phase 18 builds the user-facing experience: a script editor with IntelliSense-like features, a target machine/group selector, real-time output streaming, and a library of saved scripts that administrators can share and schedule. Think of it as a cloud-based PowerShell ISE that can target any machine.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**

### Script Runner Plugin (`script-runner`)
- Dashboard panel: quick script execution widget (recent scripts + run button)
- Sidebar tool: full script editor with target selection and output viewer
- Code editor: syntax-highlighted editor for PS/Python/Batch/VBS
- Target selector: pick machines, groups, or "all" as execution targets
- Execution options: parallel/sequential, timeout, parameters
- Live output: real-time per-machine output as scripts execute
- Execution history: recent runs with results (in-session)

### Script Library Plugin (`script-library`)
- Sidebar tool: browsable library of saved scripts
- Save dialog: name, description, language, tags, category
- Script CRUD: create, edit, delete, duplicate, export
- Tagging and categorization for organization
- Search and filter by name, language, tags
- One-click execute from library (pre-fills runner)
- Run count and last-run tracking
- Import/export scripts as files

**Out of scope:**
- Scheduled script execution (Phase 9 Scheduler handles cron jobs)
- Script version history / git integration (future)
- Collaborative script editing (future)
- Script marketplace / community sharing (future)

---

## Prerequisites
- Phase 3 (Script Executor — `POST /api/scripts/run`, multi-language support)
- Phase 5 (SQLite — `script_library` table for saved scripts)
- Phase 7 (SignalR — future: script output streaming; Phase 18 uses polling)
- Phase 12 (Plugin Renderer — loads Panel and Tool components)
- Phase 13 (Dashboard Grid — hosts the quick-run panel)
- Phase 14 (Machine Management — machine/group list for target selector)
- Phase 15 (Machine Overview — context menu integration)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifests | `plugin.json` (Phase 6 schema) |
| Code editor | `monaco-editor` or `@monaco-editor/react` (VS Code's editor engine) |
| Syntax highlighting | Monaco built-in (PowerShell, Python, Batch, VBScript) |
| Script execution | `POST /api/scripts/run` (Phase 3) |
| Script persistence | SQLite `script_library` table (Phase 5) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens (Phase 11) |

---

## Detailed Tasks

### 1. Create Script Runner Plugin Manifest

```json
// plugins/script-runner/plugin.json
{
  "id": "script-runner",
  "name": "Script Runner",
  "description": "Execute PowerShell, Python, Batch, and VBScript on any machine or group. Live output, parallel execution, and parameter support.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "Meta",
  "icon": "play",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "quick-run",
        "title": "Quick Script",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 0,
        "data_source": ""
      }
    ],
    "tools": [
      {
        "id": "runner",
        "title": "Script Runner",
        "icon": "play",
        "component": "ui/Tool",
        "sidebar_group": "Scripts",
        "sidebar_order": 1
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "script-runner.execute",
        "title": "Run Script",
        "icon": "play",
        "scripts": {},
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": true,
        "confirm_message": "Execute this script on the selected targets?"
      },
      {
        "id": "script-runner.run-on-machine",
        "title": "Run Script on This Machine",
        "icon": "terminal-square",
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
        "command": "script-runner.run-on-machine"
      },
      {
        "location": "quick_actions",
        "command": "script-runner.execute"
      }
    ],
    "settings_page": {
      "id": "script-runner-settings",
      "title": "Script Runner Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },

  "config_schema": {
    "default_language": {
      "type": "string",
      "default": "powershell",
      "label": "Default script language"
    },
    "default_timeout": {
      "type": "number",
      "default": 60,
      "label": "Default timeout (seconds)"
    },
    "default_parallel": {
      "type": "boolean",
      "default": false,
      "label": "Default to parallel execution"
    },
    "max_output_lines": {
      "type": "number",
      "default": 5000,
      "label": "Maximum output lines to display"
    },
    "editor_font_size": {
      "type": "number",
      "default": 14,
      "label": "Editor font size (px)"
    },
    "editor_minimap": {
      "type": "boolean",
      "default": false,
      "label": "Show editor minimap"
    },
    "auto_save_drafts": {
      "type": "boolean",
      "default": true,
      "label": "Auto-save script drafts in browser"
    }
  }
}
```

### 2. Create Script Library Plugin Manifest

```json
// plugins/script-library/plugin.json
{
  "id": "script-library",
  "name": "Script Library",
  "description": "Save, organize, and reuse scripts. Browse by category, search by tags, and execute saved scripts with one click.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "Meta",
  "icon": "book-open",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [],
    "tools": [
      {
        "id": "library",
        "title": "Script Library",
        "icon": "book-open",
        "component": "ui/Tool",
        "sidebar_group": "Scripts",
        "sidebar_order": 2
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "script-library.save",
        "title": "Save to Library",
        "icon": "save",
        "scripts": {},
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      }
    ],
    "menus": [
      {
        "location": "dashboard_toolbar",
        "command": "script-library.save"
      }
    ],
    "settings_page": null
  },

  "permissions": {
    "winrm": false,
    "domain_admin": false,
    "run_scripts": false
  },

  "config_schema": {}
}
```

### 3. Create Script Runner — Backend API Extension

```csharp
// src/Nexus.Gateway/Controllers/ScriptsController.cs — EXTEND Phase 3 controller:
//
// These endpoints extend the Phase 3 ScriptsController for library management.
// The run endpoint already exists from Phase 3.

// Library CRUD (stored in SQLite script_library table from Phase 5)
[HttpGet("library")]           // List all saved scripts (with search/filter)
[HttpGet("library/{id}")]      // Get single saved script with content
[HttpPost("library")]          // Save new script to library
[HttpPut("library/{id}")]      // Update saved script
[HttpDelete("library/{id}")]   // Delete saved script
[HttpPost("library/{id}/run")] // Execute a saved script (shortcut)
[HttpPost("library/{id}/duplicate")] // Clone a saved script
[HttpGet("library/tags")]      // Get all unique tags across scripts
[HttpPost("library/import")]   // Import script from .ps1/.py/.bat file upload
[HttpGet("library/{id}/export")] // Export/download script file
```

### 4. Create Script Runner Tool Component

```tsx
// plugins/script-runner/ui/Tool.tsx
//
// Full-page script execution tool.
// Sidebar: Scripts → Script Runner
// Route: /plugins/script-runner/runner
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Script Runner                              [Save to Library 💾] │
// ├─────────────────────┬────────────────────────────────────────────┤
// │  Language: [PS ▼]   │  Target: [DC01, SQL01 ▼]  [+ Add Target] │
// │  Timeout: [60s]     │  Execution: [● Sequential ○ Parallel]    │
// ├─────────────────────┴────────────────────────────────────────────┤
// │                                                                  │
// │  ┌─ Editor ─────────────────────────────────────────────────┐   │
// │  │  1 │ # Get all running services                          │   │
// │  │  2 │ Get-Service | Where-Object {                        │   │
// │  │  3 │     $_.Status -eq 'Running'                         │   │
// │  │  4 │ } | Select-Object Name, DisplayName, Status |       │   │
// │  │  5 │   Sort-Object Name                                  │   │
// │  │  6 │                                                     │   │
// │  │  7 │                                                     │   │
// │  └──────────────────────────────────────────────────────────┘   │
// │                                                                  │
// │  ┌─ Parameters ──────────────────────────────────────────────┐  │
// │  │  $ServiceName = [________]   $MaxResults = [100_]         │  │
// │  └──────────────────────────────────────────────────────────┘   │
// │                                                                  │
// │  [▶ Run] [▶ Run on All] [Clear]              Status: Ready     │
// ├──────────────────────────────────────────────────────────────────┤
// │  ┌─ Output ──────────────────────────────────────────────────┐  │
// │  │  ─── DC01 (Success, 1.2s) ───                             │  │
// │  │  Name         DisplayName              Status              │  │
// │  │  ----         -----------              ------              │  │
// │  │  ADWS         Active Dir. Web Svc      Running             │  │
// │  │  DNS          DNS Server               Running             │  │
// │  │  ...                                                      │  │
// │  │  ─── SQL01 (Success, 0.8s) ───                            │  │
// │  │  Name         DisplayName              Status              │  │
// │  │  MSSQLSERVER  SQL Server               Running             │  │
// │  │  ...                                                      │  │
// │  └──────────────────────────────────────────────────────────┘   │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Monaco editor with syntax highlighting for PS/Python/Batch/VBS
// - Language selector: changes editor syntax mode
// - Target selector: multi-select machines and/or groups
//   - "Target: [DC01, SP-SPSE (group), SQL01]"
//   - Type to search, click to add, × to remove
//   - Special option: "All Machines"
// - Execution mode: sequential (default) or parallel
// - Timeout: configurable per-run (default from settings)
// - Parameters panel: auto-detected from script `param()` block
//   - For PowerShell: parse param() to extract parameter names
//   - Show text input per parameter
// - Run button: executes via POST /api/scripts/run
// - Output panel: split by machine, color-coded success/failure
//   - Per-machine header with hostname, result, duration
//   - Green header = success, Red header = failure
//   - Error output in red text
//   - Output supports ANSI color codes
// - "Save to Library" button: opens save dialog
// - Draft auto-save: saves current editor content to localStorage

interface ToolProps {
  context: NexusPluginContext;
}

// State:
// - scriptContent: string
// - language: 'powershell' | 'python' | 'batch' | 'vbscript'
// - targets: string[] (hostnames and group IDs)
// - parallel: boolean
// - timeout: number
// - parameters: { name: string, value: string }[]
// - isExecuting: boolean
// - executionResult: ScriptResult | null
// - showSaveDialog: boolean
```

### 5. Create Script Editor Component

```tsx
// plugins/script-runner/ui/components/ScriptEditor.tsx
//
// Monaco editor wrapper with NEXUS theme integration.
//
// Features:
// - Syntax highlighting: PowerShell, Python, Batch (shell), VBScript
// - Theme integration: maps NEXUS CSS variables to Monaco editor theme
//   - Dark theme: vs-dark base with NEXUS accent colors
//   - Light theme: vs base with NEXUS colors
// - Editor options from plugin settings:
//   - Font size, font family (mono), minimap toggle
// - Auto-resize to fill available container height
// - Keyboard shortcuts:
//   - Ctrl+Enter = Execute script (triggers run)
//   - Ctrl+S = Save to library (opens save dialog)
//   - Ctrl+Shift+Space = toggle parameters panel
// - PowerShell param() detection: regex parse for parameter names
// - Line numbers, bracket matching, auto-indent
// - Read-only mode for viewing library scripts before editing
//
// Props:
// - value: string
// - language: string
// - onChange: (value: string) => void
// - onExecute: () => void  (Ctrl+Enter)
// - readOnly?: boolean
// - settings: EditorSettings
//
// Monaco theme definition:
// {
//   base: 'vs-dark',  // or 'vs' for light themes
//   rules: [
//     { token: 'comment', foreground: 'var(--color-text-muted)' },
//     { token: 'keyword', foreground: 'var(--color-accent-1)' },
//     { token: 'string', foreground: 'var(--color-accent-2)' },
//     { token: 'number', foreground: 'var(--color-status-warning)' },
//   ],
//   colors: {
//     'editor.background': 'var(--color-bg-primary)',
//     'editor.foreground': 'var(--color-text-primary)',
//     'editor.lineHighlightBackground': 'var(--color-bg-hover)',
//     'editorCursor.foreground': 'var(--color-accent-1)',
//   }
// }
```

### 6. Create Target Selector Component

```tsx
// plugins/script-runner/ui/components/TargetSelector.tsx
//
// Multi-select input for choosing script execution targets.
// Shared between script-runner and script-library.
//
// Layout:
// ┌──────────────────────────────────────────────┐
// │  Target: [DC01 ×] [SP-SPSE ×] [SQL01 ×] |   │
// │          [type to search machines/groups...] │
// └──────────────────────────────────────────────┘
//
// Dropdown options:
// ── Machines ──────────
//   ● DC01 — Domain Controller
//   ● SQL01 — SQL Server
//   ○ WIN11 — Windows 11 (Offline)
//   ● SPSE-WFE01 — SPSE Web Front End
// ── Groups ────────────
//   SP-SPSE (2 machines)
//   SP-2019 (2 machines)
// ── Special ───────────
//   All Machines (9)
//
// Features:
// - Type to filter machines and groups
// - Selected items shown as removable pills
// - Groups are expandable (click to see member machines)
// - "All Machines" special option
// - Offline machines shown with warning, still selectable
// - Machine status dots (online/offline)
// - Keyboard navigation: arrow keys + Enter to select
//
// Props:
// - selectedTargets: string[]
// - onChange: (targets: string[]) => void
// - machines: MachineDetail[]
// - groups: MachineGroupDetail[]
// - placeholder?: string
```

### 7. Create Output Viewer Component

```tsx
// plugins/script-runner/ui/components/OutputViewer.tsx
//
// Displays script execution results, split by machine.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────┐
// │  Output                  [Copy All] [Clear] [Wrap ☐]        │
// │  ─── DC01 ✓ (Success, 1.2s) ────────────────────────────── │
// │  Name         DisplayName              Status                │
// │  ----         -----------              ------                │
// │  ADWS         Active Dir. Web Svc      Running               │
// │  DNS          DNS Server               Running               │
// │  ...                                                         │
// │                                                              │
// │  ─── SQL01 ✓ (Success, 0.8s) ──────────────────────────── │
// │  Name         DisplayName              Status                │
// │  MSSQLSERVER  SQL Server               Running               │
// │  ...                                                         │
// │                                                              │
// │  ─── WIN11 ✗ (Failed, 30.0s — Timeout) ───────────────── │
// │  Error: The WinRM client cannot complete the operation       │
// │  within the time specified.                                  │
// └──────────────────────────────────────────────────────────────┘
//
// Features:
// - Per-machine sections with collapsible headers
// - Success: green header with ✓ icon, duration
// - Failure: red header with ✗ icon, error summary
// - Output text in monospace font (--font-family-mono)
// - Error output in --color-danger (red)
// - Copy per-machine output or copy all
// - Word wrap toggle
// - ANSI color code rendering (basic: red, green, yellow, cyan)
// - Scroll to bottom on new output
// - "No output" placeholder when script returns empty
// - Maximum line cap from settings (default 5000) with "truncated" warning
//
// Props:
// - result: ScriptResult | null
// - isExecuting: boolean
// - maxLines: number
```

### 8. Create Dashboard Quick-Run Panel

```tsx
// plugins/script-runner/ui/Panel.tsx
//
// Compact dashboard widget for quick script execution.
// Default size: 6 columns, 4 rows.
//
// Layout:
// ┌──────────────────────────────────────────────────────┐
// │  Quick Script                        [Open Runner →] │
// ├──────────────────────────────────────────────────────┤
// │                                                      │
// │  Recent Scripts:                                     │
// │  ▶ Get running services        [PS]  2 min ago      │
// │  ▶ Check disk space            [PS]  1 hour ago     │
// │  ▶ Clear temp files            [Bat] Yesterday      │
// │                                                      │
// │  Quick Run: [PowerShell ▼]                          │
// │  ┌──────────────────────────────────────────────┐   │
// │  │ Get-Process | Sort CPU -Desc | Select -F 10  │   │
// │  └──────────────────────────────────────────────┘   │
// │  Target: [DC01 ▼]           [▶ Run]                │
// │                                                      │
// └──────────────────────────────────────────────────────┘
//
// Features:
// - Recent scripts list (last 5 runs, stored in session)
// - Click recent script → re-runs with same targets
// - Quick run: single-line textarea + machine dropdown + run button
// - "Open Runner →" link navigates to full Script Runner tool
// - Compact: no output display — results open in runner tool
```

### 9. Create Script Library Tool Component

```tsx
// plugins/script-library/ui/Tool.tsx
//
// Full-page script library browser.
// Sidebar: Scripts → Script Library
// Route: /plugins/script-library/library
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Script Library                     [+ New Script] [⬆ Import]  │
// │  [Search scripts...]  [Language ▼] [Tags ▼] [Sort ▼]          │
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  ┌──────────────────────────────────────────────────────────────┐│
// │  │ 📝 Get Running Services                                [PS] ││
// │  │    List all running services, sorted by name                ││
// │  │    Tags: [services] [monitoring]  ·  Runs: 42  ·  Last: 2h ││
// │  │    [▶ Run] [✏ Edit] [📋 Duplicate] [⬇ Export] [🗑 Delete]  ││
// │  └──────────────────────────────────────────────────────────────┘│
// │                                                                  │
// │  ┌──────────────────────────────────────────────────────────────┐│
// │  │ 📝 Check Disk Space                                    [PS] ││
// │  │    Reports disk usage on all drives with >80% alert         ││
// │  │    Tags: [disk] [health] [alert]  ·  Runs: 15  ·  Last: 1d ││
// │  │    [▶ Run] [✏ Edit] [📋 Duplicate] [⬇ Export] [🗑 Delete]  ││
// │  └──────────────────────────────────────────────────────────────┘│
// │                                                                  │
// │  ┌──────────────────────────────────────────────────────────────┐│
// │  │ 📝 Clear Temp Files                                   [Bat] ││
// │  │    Removes temp files older than 7 days from all machines   ││
// │  │    Tags: [cleanup] [maintenance]  ·  Runs: 8  ·  Last: 3d  ││
// │  │    [▶ Run] [✏ Edit] [📋 Duplicate] [⬇ Export] [🗑 Delete]  ││
// │  └──────────────────────────────────────────────────────────────┘│
// │                                                                  │
// │  Showing 3 of 3 scripts                                         │
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Script cards with name, description, language badge, tags
// - Search: real-time filter by name, description, or tag
// - Filter by language: PowerShell / Python / Batch / VBScript / All
// - Filter by tags: dropdown with all unique tags
// - Sort: Name (A-Z), Last Run, Run Count, Created Date
// - Action buttons per script:
//   - Run: opens script in Runner with content pre-filled
//   - Edit: opens script in inline editor or Runner edit mode
//   - Duplicate: creates a copy with "(Copy)" suffix
//   - Export: downloads as .ps1 / .py / .bat / .vbs file
//   - Delete: confirmation dialog, then removes from library
// - "New Script" → opens Runner in new-script mode
// - "Import" → file upload dialog (.ps1, .py, .bat, .vbs)
// - Run count and last-run timestamp per script
// - Empty state: "No scripts saved yet" with link to Runner

interface ToolProps {
  context: NexusPluginContext;
}

// State:
// - scripts: LibraryScript[]
// - searchQuery: string
// - languageFilter: string | 'all'
// - tagFilter: string | null
// - sortField: 'name' | 'lastRun' | 'runCount' | 'createdAt'
// - sortDirection: 'asc' | 'desc'
// - isLoading: boolean
// - selectedScript: LibraryScript | null (for preview/edit)
```

### 10. Create Save Script Dialog

```tsx
// plugins/script-runner/ui/components/SaveDialog.tsx
//
// Modal for saving a script to the library.
// Opened from "Save to Library" in the Runner.
//
// Layout:
// ┌───────────────────────────────────────────┐
// │  Save Script to Library                   │
// │                                           │
// │  Name:        [Get Running Services    ]  │
// │  Description: [List all running services, │
// │                sorted by name           ] │
// │  Language:    [PowerShell ▼] (read-only)  │
// │  Tags:        [services] [monitoring] [+] │
// │                                           │
// │  ☐ Include current targets as defaults   │
// │  ☐ Include current parameters            │
// │                                           │
// │  [Cancel]                     [💾 Save]   │
// └───────────────────────────────────────────┘
//
// Features:
// - Pre-fills language from current editor mode
// - Tag input: type + Enter to add, × to remove
// - Tag suggestions from existing library tags
// - Optional: save default targets and parameters with script
// - Validation: name is required, no duplicate names
// - Edit mode: same dialog for updating existing scripts
```

### 11. Create Script Library Preview Component

```tsx
// plugins/script-library/ui/components/ScriptPreview.tsx
//
// Slide-out drawer showing full script content and metadata.
// Opens when clicking a script card or "Edit" button.
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  ← Close   Get Running Services    [PS]  │
// ├──────────────────────────────────────────┤
// │  Description:                            │
// │  List all running services, sorted by    │
// │  name. Works on all Windows machines.    │
// │                                          │
// │  Created: 2026-06-01  ·  Modified: Today │
// │  Runs: 42  ·  Last run: 2 hours ago      │
// │  Tags: [services] [monitoring]           │
// ├──────────────────────────────────────────┤
// │  ┌─ Script Content (read-only) ────────┐ │
// │  │  1 │ Get-Service |                  │ │
// │  │  2 │   Where-Object {               │ │
// │  │  3 │     $_.Status -eq 'Running'    │ │
// │  │  4 │   } |                          │ │
// │  │  5 │   Select-Object Name, Display  │ │
// │  │  6 │     Name, Status |             │ │
// │  │  7 │   Sort-Object Name             │ │
// │  └────────────────────────────────────┘   │
// ├──────────────────────────────────────────┤
// │  [▶ Run] [✏ Edit in Runner] [📋 Copy]  │
// └──────────────────────────────────────────┘
//
// Props:
// - script: LibraryScript
// - onClose: () => void
// - onRun: (script: LibraryScript) => void
// - onEdit: (script: LibraryScript) => void
// - context: NexusPluginContext
```

### 12. Create TypeScript Types

```typescript
// plugins/script-runner/ui/types.ts

/** Script execution request (mirrors backend ScriptRunRequest from Phase 3) */
export interface ScriptRunRequest {
  scriptPath?: string;          // For library scripts (relative to plugin)
  scriptContent?: string;       // For ad-hoc scripts (inline content)
  pluginId?: string;
  language: ScriptLanguage;
  targets: string[];            // Hostnames, group IDs, or "all"
  parallel: boolean;
  timeoutSeconds: number;
  parameters: Record<string, string>;
}

export type ScriptLanguage = 'powershell' | 'python' | 'batch' | 'vbscript';

/** Execution result (mirrors backend ScriptResult from Phase 3) */
export interface ScriptResult {
  executionId: string;
  startedAt: string;
  completedAt: string | null;
  results: MachineScriptResult[];
  success: boolean;
}

export interface MachineScriptResult {
  hostname: string;
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  duration: string;             // TimeSpan as string
}

/** Saved script in the library (mirrors SQLite script_library table from Phase 5) */
export interface LibraryScript {
  id: number;
  name: string;
  description: string;
  language: ScriptLanguage;
  content: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  modifiedAt: string;
  runCount: number;
  lastRunAt: string | null;
  defaultTargets?: string[];    // Optional saved default targets
  defaultParameters?: Record<string, string>;  // Optional saved parameters
}

export interface SaveScriptRequest {
  name: string;
  description: string;
  language: ScriptLanguage;
  content: string;
  tags: string[];
  defaultTargets?: string[];
  defaultParameters?: Record<string, string>;
}

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  minimap: boolean;
  wordWrap: boolean;
  theme: 'nexus-dark' | 'nexus-light';
}

/** Detected script parameter from param() block parsing */
export interface DetectedParameter {
  name: string;
  type: string;                 // string, int, bool, etc.
  mandatory: boolean;
  defaultValue: string | null;
}
```

### 13. Create Script Runner Settings Page

```tsx
// plugins/script-runner/ui/Settings.tsx
//
// Settings page for the Script Runner plugin.
// Accessible via: Settings → Script Runner Settings
//
// Fields:
// - Default language: dropdown (PowerShell / Python / Batch / VBScript)
// - Default timeout: number input (10–600 seconds, default 60)
// - Default parallel: toggle
// - Max output lines: number input (1000–50000, default 5000)
// - Editor font size: number slider (8–24, default 14)
// - Editor minimap: toggle (default off)
// - Auto-save drafts: toggle (saves current editor to localStorage)
//
// Editor preview: small Monaco editor showing sample script with current settings
```

### 14. Backend — Extend ScriptsController for Library

```csharp
// src/Nexus.Gateway/Controllers/ScriptsController.cs — ADD to Phase 3 controller:

[HttpGet("library")]
public async Task<IActionResult> GetLibrary(
    [FromQuery] string? search = null,
    [FromQuery] string? language = null,
    [FromQuery] string? tag = null)
{
    var scripts = await _db.ScriptLibrary
        .Where(s => search == null || s.Name.Contains(search) || s.Description.Contains(search))
        .Where(s => language == null || s.Language == language)
        .Where(s => tag == null || s.Tags.Contains(tag))
        .OrderByDescending(s => s.ModifiedAt)
        .ToListAsync();
    return Ok(scripts);
}

[HttpGet("library/{id}")]
public async Task<IActionResult> GetScript(int id)
{
    var script = await _db.ScriptLibrary.FindAsync(id);
    return script is null ? NotFound() : Ok(script);
}

[HttpPost("library")]
public async Task<IActionResult> SaveScript([FromBody] SaveScriptRequest request)
{
    var entity = new ScriptLibraryItem
    {
        Name = request.Name,
        Description = request.Description,
        Language = request.Language,
        Content = request.Content,
        Tags = JsonSerializer.Serialize(request.Tags),
        CreatedBy = User.Identity?.Name ?? "system",
        CreatedAt = DateTime.UtcNow.ToString("o"),
        ModifiedAt = DateTime.UtcNow.ToString("o")
    };
    _db.ScriptLibrary.Add(entity);
    await _db.SaveChangesAsync();
    return Created($"/api/scripts/library/{entity.Id}", entity);
}

[HttpPut("library/{id}")]
public async Task<IActionResult> UpdateScript(int id, [FromBody] SaveScriptRequest request) { ... }

[HttpDelete("library/{id}")]
public async Task<IActionResult> DeleteScript(int id) { ... }

[HttpPost("library/{id}/run")]
public async Task<IActionResult> RunLibraryScript(int id, [FromBody] ScriptRunTargets targets) { ... }

[HttpPost("library/{id}/duplicate")]
public async Task<IActionResult> DuplicateScript(int id) { ... }

[HttpGet("library/tags")]
public async Task<IActionResult> GetAllTags() { ... }

[HttpPost("library/import")]
public async Task<IActionResult> ImportScript(IFormFile file) { ... }

[HttpGet("library/{id}/export")]
public async Task<IActionResult> ExportScript(int id) { ... }

// Also add ad-hoc run support (run inline script content without saving):
[HttpPost("run/inline")]
public async Task<IActionResult> RunInline([FromBody] InlineScriptRunRequest request)
{
    // Like POST /api/scripts/run but accepts script content directly instead of path
    // Security: content runs via WinRM, not on NEXUS host
}
```

---

## API Endpoints Produced

Phase 18 extends the Phase 3 `ScriptsController` with new endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scripts/run` | Execute script (Phase 3 — existing) |
| POST | `/api/scripts/run/inline` | Execute inline script content (**NEW**) |
| GET | `/api/scripts/library` | List saved scripts (search, filter) |
| GET | `/api/scripts/library/{id}` | Get single saved script |
| POST | `/api/scripts/library` | Save new script to library |
| PUT | `/api/scripts/library/{id}` | Update saved script |
| DELETE | `/api/scripts/library/{id}` | Delete saved script |
| POST | `/api/scripts/library/{id}/run` | Execute saved script |
| POST | `/api/scripts/library/{id}/duplicate` | Clone saved script |
| GET | `/api/scripts/library/tags` | Get all unique tags |
| POST | `/api/scripts/library/import` | Upload script file |
| GET | `/api/scripts/library/{id}/export` | Download script file |

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/script-runner/plugin.json` | Create | Runner manifest |
| `plugins/script-runner/ui/Panel.tsx` | Create | Quick-run dashboard panel |
| `plugins/script-runner/ui/Tool.tsx` | Create | Full script editor + execution |
| `plugins/script-runner/ui/Settings.tsx` | Create | Runner settings page |
| `plugins/script-runner/ui/types.ts` | Create | Shared TypeScript types |
| `plugins/script-runner/ui/components/ScriptEditor.tsx` | Create | Monaco editor wrapper |
| `plugins/script-runner/ui/components/TargetSelector.tsx` | Create | Machine/group multi-select |
| `plugins/script-runner/ui/components/OutputViewer.tsx` | Create | Execution results display |
| `plugins/script-runner/ui/components/SaveDialog.tsx` | Create | Save-to-library modal |
| `plugins/script-runner/README.md` | Create | Runner documentation |
| `plugins/script-library/plugin.json` | Create | Library manifest |
| `plugins/script-library/ui/Tool.tsx` | Create | Library browser page |
| `plugins/script-library/ui/components/ScriptPreview.tsx` | Create | Script detail drawer |
| `plugins/script-library/README.md` | Create | Library documentation |
| `src/Nexus.Gateway/Controllers/ScriptsController.cs` | Modify | Add library CRUD + inline run |

---

## Integration Points

- **Phase 3 (Script Executor):** `POST /api/scripts/run` is the core execution engine. Phase 18 adds `POST /api/scripts/run/inline` for ad-hoc scripts and `POST /api/scripts/library/{id}/run` for library shortcuts. All execution flows through Phase 3's `IScriptExecutor`.
- **Phase 5 (SQLite):** The `script_library` table (already defined in Phase 5 schema) stores saved scripts. Phase 18 implements CRUD operations on this table.
- **Phase 6 (Plugin Loader):** Both `script-runner` and `script-library` plugin manifests are loaded independently. They integrate via API calls, not direct coupling.
- **Phase 9 (Scheduler):** The scheduler (Phase 9) can reference scripts from the library by `script_library_id`. Scripts saved in Phase 18 become available for scheduling.
- **Phase 12 (Plugin Renderer):** Both plugins contribute sidebar tools under the "Scripts" group.
- **Phase 14 (Machine Management):** Target selector uses `GET /api/machines` and `GET /api/machines/groups`.
- **Phase 15 (Machine Overview):** Context menu "Run Script on This Machine" opens runner with target pre-set.

---

## Test Criteria
- [ ] Both plugin manifests validate as valid JSON matching Phase 6 schema
- [ ] Sidebar shows "Script Runner" and "Script Library" under Scripts group
- [ ] Monaco editor loads with PowerShell syntax highlighting
- [ ] Language switch changes editor syntax mode (PS → Python → Batch)
- [ ] Target selector shows all machines and groups from Phase 14
- [ ] "All Machines" target option selects every active machine
- [ ] Typing `Get-Service` and clicking Run executes on selected machine
- [ ] Output viewer shows per-machine results with success/failure headers
- [ ] Parallel execution runs on all targets concurrently with results
- [ ] Execution timeout (60s default) kills hung scripts and shows timeout error
- [ ] Parameter detection: script with `param($Name, $Count)` shows 2 input fields
- [ ] Ctrl+Enter shortcut executes the current script
- [ ] "Save to Library" opens dialog and saves script to SQLite
- [ ] `GET /api/scripts/library` returns saved scripts with search/filter
- [ ] Library tool shows saved scripts with name, description, tags, run count
- [ ] Search in library filters by name and description
- [ ] Language filter shows only scripts of selected language
- [ ] "Run" button on library card opens runner with script pre-filled
- [ ] "Edit" opens script in runner editor for modification
- [ ] "Duplicate" creates a copy with "(Copy)" appended to name
- [ ] "Export" downloads script as .ps1/.py/.bat file
- [ ] "Import" uploads a script file and adds to library
- [ ] "Delete" shows confirmation, then removes from library
- [ ] Run count increments and last-run timestamp updates after execution
- [ ] Dashboard quick-run panel shows recent scripts and single-line executor
- [ ] Draft auto-save: refreshing page restores unsaved editor content
- [ ] All components use CSS variable theme tokens (no hardcoded colors)
- [ ] Monaco editor theme matches active NEXUS theme
- [ ] `dotnet build` succeeds (controller changes)
- [ ] `npm run build` includes both plugin components without errors

---

## Sub-Phase Breakdown (if needed)
- **18-0:** Plugin manifests + READMEs + folder structure + types
- **18-1:** `ScriptEditor.tsx` — Monaco editor wrapper + theme + language modes
- **18-2:** `TargetSelector.tsx` — machine/group multi-select
- **18-3:** `OutputViewer.tsx` — per-machine results display
- **18-4:** Script Runner `Tool.tsx` — wire editor + targets + execution + output
- **18-5:** Backend — extend ScriptsController with library CRUD + inline run
- **18-6:** Script Library `Tool.tsx` — browse, search, filter saved scripts
- **18-7:** `SaveDialog.tsx` + `ScriptPreview.tsx` — save and preview flows
- **18-8:** Dashboard Panel (`Panel.tsx`) — quick-run widget
- **18-9:** Parameter detection, import/export, Ctrl+Enter shortcut
- **18-10:** Settings page + draft auto-save + context menu + polish

---

## Notes for Coding Agent
- **Monaco editor**: Add `@monaco-editor/react` to `package.json` if not already present. This package bundles Monaco as a web worker and integrates cleanly with React.
- **Inline execution**: Phase 3's `ScriptExecutor` validates that scripts are inside the `plugins/` directory. For ad-hoc scripts, the `POST /api/scripts/run/inline` endpoint should write the content to a temp file inside a sandboxed directory (e.g., `data/temp-scripts/`), execute it, then clean up. NEVER execute user-provided script content directly without the sandbox path.
- **Security**: Ad-hoc scripts run on REMOTE machines via WinRM, not on the NEXUS host. The script content is sent to the target machine and executed there. The NEXUS service is just a relay.
- **Monaco theme**: Monaco uses its own theme format, not CSS variables directly. Create a custom theme at initialization time by reading computed CSS variable values via `getComputedStyle()`. Re-create the theme when NEXUS theme changes.
- **PowerShell param() parsing**: Use regex `param\s*\(\s*(.*?)\s*\)` to extract parameter block. Parse each parameter: `[Parameter(Mandatory=$true)][string]$Name = "default"`. Handle multiline param blocks.
- **Script library tags**: Tags are stored as a JSON array in the `tags` column of `script_library` table. Use `System.Text.Json` for serialization. The `GET /api/scripts/library/tags` endpoint should aggregate all unique tags across all scripts.
- **Cross-plugin navigation**: "Run" button in script-library navigates to `/plugins/script-runner/runner?libraryId={id}`. The runner tool reads the query param, fetches the script, and pre-fills the editor.
- **Draft auto-save**: Use `localStorage` key `nexus.script-runner.draft` to save current editor content, language, and targets every 5 seconds. Restore on component mount if draft exists. Show "Draft restored" toast.
- **Output ANSI colors**: PowerShell can produce ANSI escape sequences in output. Use a library like `ansi-to-react` or simple regex replacement to render colors in the output viewer.
- **File import**: Accept `.ps1`, `.py`, `.bat`, `.cmd`, `.vbs` extensions only. Read content, detect language from extension, pre-fill save dialog. Max file size: 1MB.
- **Script library is global**: All users share the same library. The `created_by` field tracks who saved a script but doesn't restrict access. Fine-grained permissions are future work.
- **Run count tracking**: When executing a library script (via `POST /api/scripts/library/{id}/run`), increment `run_count` and update `last_run_at` in the database. This happens in the controller, not the executor.


---

## ⚡ Integration Update — TRMM Community Scripts as Seed Library

**Do NOT write built-in scripts from scratch.** Use TRMM community scripts:

```
Source: github.com/amidaware/community-scripts/scripts/
License: Source-available — free to use internally, cannot resell as RMM product
```

**Scripts to import as NEXUS built-in library:**

| TRMM Script File | NEXUS Category | Notes |
|---|---|---|
| `Win_Disk_Cleanup.ps1` | Maintenance | Direct use |
| `Win_Windows_Update_*.ps1` | Patching | Adapt for NEXUS |
| `Win_Services_Check_*.ps1` | Monitoring | Direct use |
| `Win_Get_Installed_Software.ps1` | Inventory | Direct use |
| `Win_Computer_Rename.ps1` | Management | Direct use |
| `Win_Event_Log_*.ps1` | Diagnostics | Direct use |
| `Win_Get_Disk_Usage.ps1` | Monitoring | Direct use |
| `Win_Reboot_If_Needed.ps1` | Maintenance | Direct use |

**Process:**
1. Clone `github.com/amidaware/community-scripts` locally
2. Review `community_scripts.json` for Windows-only scripts
3. Copy relevant .ps1/.py/.bat files to `plugins/script-library/scripts/`
4. Map them to NEXUS categories in DatabaseSeeder
5. Write SP-specific scripts manually (no TRMM equivalent exists)

**Estimated effort revised: 0.5 days** (was 1 day) — most scripts are ready-made