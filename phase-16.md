# Phase 16 — Remote Terminal Plugin (Interactive PowerShell via xterm.js)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the `remote-terminal` plugin — a fully interactive, browser-based PowerShell terminal that connects to any managed machine via WinRM. Uses xterm.js in the frontend for terminal rendering and the SignalR `TerminalHub` (Phase 7) for bidirectional I/O streaming. Administrators can open multiple terminal tabs to different machines simultaneously, resize terminals, and copy/paste. This is one of NEXUS's highest-value features — replacing RDP + PowerShell ISE with a single browser tab.

---

## Context: What is NEXUS?
NEXUS manages domain machines agentlessly via WinRM. Phase 7 built the `TerminalHub` (SignalR) and `TerminalSessionStore` on the backend — the plumbing for streaming keystrokes to a remote PowerShell runspace and piping output back to the browser. Phase 16 builds the frontend experience on top: a rich terminal emulator using xterm.js, session management (open/close/reconnect), multi-tab support, and integration into the plugin system so it appears in the sidebar, context menus, and quick actions.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- `plugins/remote-terminal/plugin.json` — plugin manifest
- Sidebar tool: full-page terminal interface with multi-tab support
- xterm.js terminal component with fit addon, web-links addon, search addon
- SignalR connection to `/hubs/terminal` for each open session
- Terminal session lifecycle: open → stream → resize → close
- Multi-tab interface: open terminals to multiple machines simultaneously
- Machine selector: pick target machine before opening a session
- Credential selection: use machine's assigned credential or choose alternate
- Copy/paste support (Ctrl+C/Ctrl+V in terminal, right-click paste)
- Terminal settings: font size, font family, cursor style, scrollback buffer
- Context menu contribution: "Open Terminal" on machine cards (Phase 15)
- Quick action contribution: "New Terminal" in floating action bar
- Session history panel: show active sessions with connect/disconnect controls
- Connection status indicator (connected / reconnecting / disconnected)
- PowerShell script: `scripts/test-winrm.ps1` for connectivity pre-check

**Out of scope:**
- SSH terminal (NEXUS targets Windows machines only)
- File transfer through terminal (use File Browser plugin, Phase 22)
- Terminal recording/playback (future enhancement)
- Multi-user shared terminal sessions (future)

---

## Prerequisites
- Phase 7 (SignalR — `TerminalHub` + `TerminalSessionStore` backend)
- Phase 8 (Credentials — `ICredentialVault` for authenticating terminal sessions)
- Phase 12 (Plugin Renderer — loads Tool component dynamically)
- Phase 14 (Machine Management — machine list and credential assignment)
- Phase 15 (Machine Overview — context menu integration for "Open Terminal")

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifest | `plugin.json` (Phase 6 schema) |
| Terminal emulator | `xterm.js` + `xterm-addon-fit` + `xterm-addon-web-links` + `xterm-addon-search` |
| WebSocket | `@microsoft/signalr` → `/hubs/terminal` (Phase 7) |
| UI components | React 18 + TypeScript |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens + xterm.js theme |
| Scripts | PowerShell 5.1+ |

---

## Detailed Tasks

### 1. Create Plugin Manifest

```json
// plugins/remote-terminal/plugin.json
{
  "id": "remote-terminal",
  "name": "Remote Terminal",
  "description": "Interactive browser-based PowerShell terminal for remote machines via WinRM. Open multiple sessions, resize, copy/paste — no RDP needed.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "System",
  "icon": "terminal-square",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [],
    "tools": [
      {
        "id": "terminal",
        "title": "Remote Terminal",
        "icon": "terminal-square",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 2
      }
    ],
    "widgets": [],
    "commands": [
      {
        "id": "remote-terminal.open",
        "title": "Open Terminal",
        "icon": "terminal-square",
        "scripts": {},
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      },
      {
        "id": "remote-terminal.test-winrm",
        "title": "Test WinRM Connection",
        "icon": "wifi",
        "scripts": {
          "powershell": "scripts/test-winrm.ps1"
        },
        "default_script": "powershell",
        "target": "single",
        "parallel": false,
        "confirm": false
      }
    ],
    "menus": [
      {
        "location": "machine_context_menu",
        "command": "remote-terminal.open"
      },
      {
        "location": "machine_context_menu",
        "command": "remote-terminal.test-winrm"
      },
      {
        "location": "quick_actions",
        "command": "remote-terminal.open"
      }
    ],
    "settings_page": {
      "id": "remote-terminal-settings",
      "title": "Terminal Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },

  "config_schema": {
    "font_size": {
      "type": "number",
      "default": 14,
      "label": "Font size (px)"
    },
    "font_family": {
      "type": "string",
      "default": "JetBrains Mono, 'Fira Code', Consolas, monospace",
      "label": "Font family"
    },
    "cursor_style": {
      "type": "string",
      "default": "block",
      "label": "Cursor style (block | underline | bar)"
    },
    "cursor_blink": {
      "type": "boolean",
      "default": true,
      "label": "Cursor blink"
    },
    "scrollback": {
      "type": "number",
      "default": 5000,
      "label": "Scrollback buffer (lines)"
    },
    "bell_sound": {
      "type": "boolean",
      "default": false,
      "label": "Enable bell sound"
    },
    "max_sessions": {
      "type": "number",
      "default": 5,
      "label": "Maximum concurrent sessions"
    }
  }
}
```

### 2. Create Terminal Tool Component (Main Page)

```tsx
// plugins/remote-terminal/ui/Tool.tsx
//
// Full-page terminal interface accessible via sidebar: System → Remote Terminal.
// Route: /plugins/remote-terminal/terminal
//
// Layout:
// ┌──────────────────────────────────────────────────────────────────┐
// │  Remote Terminal                                                  │
// ├──────────────────────────────────────────────────────────────────┤
// │  [DC01 ●] [SQL01 ●] [SPSE-WFE01 ●] [+ New Tab]               │  ← Tab bar
// ├──────────────────────────────────────────────────────────────────┤
// │                                                                  │
// │  PS C:\Users\Administrator> Get-Service | Where Status -eq Running│
// │                                                                  │
// │  Status   Name               DisplayName                        │
// │  ------   ----               -----------                        │
// │  Running  ADWS               Active Directory Web Services      │
// │  Running  CryptSvc           Cryptographic Services             │
// │  Running  DNS                DNS Server                         │
// │  Running  EventLog           Windows Event Log                  │
// │  ...                                                            │
// │                                                                  │
// │  PS C:\Users\Administrator> _                                    │
// │                                                                  │
// ├──────────────────────────────────────────────────────────────────┤
// │  Connected ● │ DC01 │ 120x30 │ Session: abc-123 │ [⚙ Settings] │  ← Status bar
// └──────────────────────────────────────────────────────────────────┘
//
// Features:
// - Tab bar at top — one tab per open terminal session
// - Each tab: machine hostname + status dot + close button (×)
// - "+" button opens machine selector to start new session
// - Active tab shows xterm.js terminal filling available space
// - Status bar: connection state, machine name, terminal dimensions, session ID
// - Tab context menu: close, close others, close all, duplicate, reconnect
// - Keyboard shortcut: Ctrl+Shift+T = new tab, Ctrl+Shift+W = close tab
// - Tabs persist in memory while switching (terminal state preserved)

interface ToolProps {
  context: NexusPluginContext;
}

// State:
// - sessions: TerminalSession[] (one per tab)
// - activeSessionId: string | null
// - showMachineSelector: boolean
```

### 3. Create xterm.js Terminal Component

```tsx
// plugins/remote-terminal/ui/components/TerminalView.tsx
//
// Core terminal component wrapping xterm.js.
// One instance per session (per tab).
//
// Responsibilities:
// 1. Initialize xterm.js Terminal instance with configured options
// 2. Load addons: FitAddon, WebLinksAddon, SearchAddon
// 3. Connect to SignalR TerminalHub:
//    - Call hub.OpenTerminal(hostname, credentialId) → receive sessionId
//    - Subscribe to hub.on('TerminalOutput', (sessionId, data) => terminal.write(data))
//    - Subscribe to hub.on('TerminalClosed', (sessionId, reason) => handleClose())
//    - Subscribe to hub.on('TerminalError', (sessionId, error) => showError())
// 4. Forward keystrokes: terminal.onData(data => hub.SendInput(sessionId, data))
// 5. Handle resize: terminal.onResize(({cols, rows}) => hub.ResizeTerminal(sessionId, cols, rows))
// 6. Auto-fit on container resize via ResizeObserver + FitAddon.fit()
// 7. Apply theme: map CSS variables to xterm.js ITheme object
// 8. Clean up: dispose terminal + close SignalR session on unmount
//
// Props:
// - hostname: string
// - credentialId: string
// - signalrManager: SignalRManager (from context)
// - settings: TerminalSettings
// - onSessionReady: (sessionId: string) => void
// - onSessionClosed: (reason: string) => void
// - onTitleChange: (title: string) => void
//
// xterm.js ITheme mapping from NEXUS theme tokens:
// {
//   background: var(--color-bg-primary),
//   foreground: var(--color-text-primary),
//   cursor: var(--color-accent-1),
//   cursorAccent: var(--color-bg-primary),
//   selectionBackground: var(--color-accent-1) + '40',  // 25% opacity
//   black: '#000000', red: '#f85149', green: '#3fb950',
//   yellow: '#d29922', blue: '#58a6ff', magenta: '#bc8cff',
//   cyan: '#39c5cf', white: '#e6edf3',
//   brightBlack: '#484f58', brightRed: '#ff7b72', brightGreen: '#56d364',
//   brightYellow: '#e3b341', brightBlue: '#79c0ff', brightMagenta: '#d2a8ff',
//   brightCyan: '#56d4dd', brightWhite: '#f0f6fc'
// }
```

### 4. Create Machine Selector Dialog

```tsx
// plugins/remote-terminal/ui/components/MachineSelector.tsx
//
// Modal dialog for choosing which machine to open a terminal to.
// Shown when clicking "+" (new tab) or "Open Terminal" from context menu.
//
// Layout:
// ┌───────────────────────────────────────────┐
// │  Open Terminal Session                     │
// │                                           │
// │  [Search machines...]                     │
// │                                           │
// │  ● DC01 — Domain Controller        [→]   │
// │  ● SQL01 — SQL Server               [→]   │
// │  ● SPSE-WFE01 — SPSE Web Front End [→]   │
// │  ● SPSE-APP01 — SPSE App Server    [→]   │
// │  ○ WIN11 — Windows 11 (Offline)     [—]   │
// │                                           │
// │  Credential: [domain-admin ▼]             │
// │                                           │
// │  [Cancel]                    [Connect]    │
// └───────────────────────────────────────────┘
//
// Features:
// - Search/filter machines by hostname or display name
// - Status indicators (online = selectable, offline = greyed out with warning)
// - Credential dropdown: defaults to machine's assigned credential_id
// - Option to use alternate credential for this session
// - Double-click machine = instant connect with default credential
// - Recently connected machines shown at top (stored in localStorage)
// - Offline machines show tooltip: "Machine is offline — terminal may fail"
```

### 5. Create Tab Bar Component

```tsx
// plugins/remote-terminal/ui/components/TabBar.tsx
//
// Horizontal tab bar above the terminal area.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────┐
// │ [● DC01 ×] [● SQL01 ×] [● SPSE-WFE01 ×]   [+ New Tab]     │
// └──────────────────────────────────────────────────────────────┘
//
// Each tab shows:
// - Status dot (green = connected, yellow = reconnecting, red = disconnected)
// - Machine hostname (truncated if needed)
// - Close button (×)
//
// Behaviors:
// - Click tab → switch active session (terminal preserved in memory)
// - Middle-click tab → close session
// - Drag tabs → reorder (optional, via pointer events)
// - Right-click tab → context menu:
//   - Close
//   - Close Others
//   - Close All
//   - Reconnect (if disconnected)
//   - Duplicate (open new session to same machine)
// - "+" button at end → opens MachineSelector
// - Tab overflow: horizontal scroll with arrow buttons
// - Max tabs enforced by config (default 5)
//
// Props:
// - sessions: TerminalSession[]
// - activeSessionId: string | null
// - onSelect: (sessionId: string) => void
// - onClose: (sessionId: string) => void
// - onNewTab: () => void
// - onContextMenu: (sessionId: string, action: TabAction) => void
```

### 6. Create Status Bar Component

```tsx
// plugins/remote-terminal/ui/components/StatusBar.tsx
//
// Bottom bar showing terminal session information.
//
// Layout:
// ┌──────────────────────────────────────────────────────────────┐
// │ Connected ●  │ DC01  │ 120×30  │ Session: abc-123 │  [⚙]   │
// └──────────────────────────────────────────────────────────────┘
//
// Segments:
// - Connection status: "Connected ●" / "Reconnecting ◐" / "Disconnected ○"
// - Machine hostname
// - Terminal dimensions (cols × rows) — updates on resize
// - Session ID (truncated)
// - Settings gear icon → opens terminal settings overlay
//
// Optional segments (if terminal supports):
// - Latency indicator: "12ms"
// - Encoding: "UTF-8"
//
// Props:
// - session: TerminalSession | null
// - connectionState: 'connected' | 'reconnecting' | 'disconnected'
// - dimensions: { cols: number, rows: number }
// - onSettingsClick: () => void
```

### 7. Create Search Overlay Component

```tsx
// plugins/remote-terminal/ui/components/SearchOverlay.tsx
//
// In-terminal search bar (like Ctrl+F in VS Code terminal).
// Uses xterm-addon-search for text matching.
//
// Triggered by: Ctrl+Shift+F (or Ctrl+F when terminal focused)
//
// Layout:
// ┌──────────────────────────────────────────┐
// │  [Find: ____________] [↑] [↓] [Aa] [.*] [×] │
// └──────────────────────────────────────────┘
//
// Features:
// - Text search within terminal scrollback buffer
// - Previous/Next match navigation (↑/↓ buttons or Enter/Shift+Enter)
// - Case-sensitive toggle (Aa)
// - Regex toggle (.*)
// - Match count: "3 of 12"
// - Close: Escape or × button
// - Highlight matches in terminal view (xterm-addon-search handles this)
//
// Props:
// - searchAddon: SearchAddon (xterm.js addon instance)
// - onClose: () => void
```

### 8. Create Terminal Session Model

```typescript
// plugins/remote-terminal/ui/types.ts

/** Represents a single terminal session (one tab) */
export interface TerminalSession {
  /** Unique session ID returned by TerminalHub.OpenTerminal */
  sessionId: string;
  /** Target machine hostname */
  hostname: string;
  /** Machine display name (for tab label) */
  displayName: string;
  /** Credential profile used for this session */
  credentialId: string;
  /** Session state */
  state: TerminalSessionState;
  /** When the session was opened */
  startedAt: Date;
  /** Terminal title (updated by PS prompt or Set-ConsoleTitle) */
  title: string;
  /** Current terminal dimensions */
  cols: number;
  rows: number;
}

export type TerminalSessionState =
  | 'connecting'      // SignalR call in progress
  | 'connected'       // Actively streaming I/O
  | 'reconnecting'    // SignalR auto-reconnect in progress
  | 'disconnected'    // Session ended (user closed or network error)
  | 'error';          // Failed to connect

export interface TerminalSettings {
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  bellSound: boolean;
  maxSessions: number;
}

export type TabAction = 'close' | 'closeOthers' | 'closeAll' | 'reconnect' | 'duplicate';
```

### 9. Create Settings Page Component

```tsx
// plugins/remote-terminal/ui/Settings.tsx
//
// Terminal settings page. Accessible via Settings → Terminal Settings.
//
// Fields (from config_schema):
// - Font size: number slider (8–24px, default 14)
// - Font family: text input with preset dropdown
//   Presets: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", "monospace"
// - Cursor style: radio group (block / underline / bar)
// - Cursor blink: toggle
// - Scrollback buffer: number input (1000–50000, default 5000)
// - Bell sound: toggle
// - Max concurrent sessions: number input (1–10, default 5)
//
// Live preview: small terminal preview area showing sample text with current settings
//
// Settings are persisted via:
// GET/PUT /api/plugins/remote-terminal/config

interface SettingsProps {
  context: NexusPluginContext;
}
```

### 10. Create PowerShell Scripts

```powershell
# plugins/remote-terminal/scripts/test-winrm.ps1
# Tests WinRM connectivity to a target machine before opening a terminal.
# Returns: JSON with connectivity status, auth method, and PS version.

param(
    [Parameter(Mandatory=$false)]
    [string]$ComputerName = $env:COMPUTERNAME
)

try {
    $session = New-PSSession -ComputerName $ComputerName -ErrorAction Stop
    $info = > 🔁 **Scheduler Required**: This operation MUST be submitted via
> WinRmCommandScheduler.EnqueueAsync(). Direct invocation is not permitted.
Invoke-Command -Session $session -ScriptBlock {
        @{
            hostname       = $env:COMPUTERNAME
            psVersion      = $PSVersionTable.PSVersion.ToString()
            osVersion      = [System.Environment]::OSVersion.VersionString
            architecture   = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
            currentUser    = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
            isAdmin        = ([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
            executionPolicy = (Get-ExecutionPolicy).ToString()
        }
    }
    Remove-PSSession $session

    @{
        success        = $true
        hostname       = $ComputerName
        remoteInfo     = $info
        authMethod     = "Kerberos"
        latencyMs      = (Measure-Command { Test-Connection -ComputerName $ComputerName -Count 1 -Quiet }).TotalMilliseconds
    } | ConvertTo-Json -Depth 3
}
catch {
    @{
        success   = $false
        hostname  = $ComputerName
        error     = $_.Exception.Message
        errorType = $_.Exception.GetType().Name
        hint      = switch -Wildcard ($_.Exception.Message) {
            "*Access is denied*"           { "Check credential permissions. Ensure the account has remote access rights." }
            "*WinRM client cannot*"        { "WinRM may not be enabled. Run 'Enable-PSRemoting -Force' on the target." }
            "*network path was not found*" { "Machine may be offline or hostname is incorrect." }
            default                        { "Check WinRM configuration: 'winrm quickconfig' on target machine." }
        }
    } | ConvertTo-Json -Depth 3
}
```

### 11. Create Plugin README

```markdown
# plugins/remote-terminal/README.md

# Remote Terminal Plugin

**ID:** `remote-terminal`
**Category:** System
**Priority:** P1 Core (Built-in)

## Description
Provides a fully interactive browser-based PowerShell terminal to any managed machine.
Uses xterm.js for rendering and SignalR WebSocket for real-time I/O streaming via WinRM.
Supports multiple simultaneous sessions, terminal search, and customizable appearance.

## Contributions
- **Sidebar Tool** — "Remote Terminal" with multi-tab terminal interface
- **Commands** — "Open Terminal", "Test WinRM Connection"
- **Context Menu** — "Open Terminal" and "Test WinRM" on machine cards
- **Quick Action** — "Open Terminal" in floating action bar

## Configuration
| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `font_size` | number | 14 | Terminal font size in pixels |
| `font_family` | string | JetBrains Mono, ... | Terminal font family |
| `cursor_style` | string | block | Cursor style: block, underline, bar |
| `cursor_blink` | boolean | true | Animate cursor blinking |
| `scrollback` | number | 5000 | Lines of scrollback buffer |
| `bell_sound` | boolean | false | Play bell sound on BEL character |
| `max_sessions` | number | 5 | Maximum concurrent terminal tabs |

## Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+T` | Open new terminal tab |
| `Ctrl+Shift+W` | Close current tab |
| `Ctrl+Shift+F` | Open search in terminal |
| `Ctrl+Shift+C` | Copy selected text |
| `Ctrl+Shift+V` | Paste from clipboard |
| `Ctrl+Tab` | Switch to next tab |
| `Ctrl+Shift+Tab` | Switch to previous tab |

## Scripts
- `scripts/test-winrm.ps1` — Tests WinRM connectivity and returns remote system info

## Dependencies
- Phase 7: SignalR TerminalHub (WebSocket I/O)
- Phase 8: Credentials Manager (session authentication)
- Phase 14: Machine Management (machine list and credentials)
- Phase 15: Machine Overview (context menu integration)

## Technical Notes
- Terminal I/O flows: browser keystroke → SignalR → TerminalHub → WinRM Runspace → PS output → SignalR → xterm.js
- Each session maintains a persistent PowerShell Runspace on the backend (Phase 7)
- Terminal resize events are forwarded to the backend to update the PTY dimensions
- Sessions are cleaned up when the SignalR connection drops (tab close, browser close)
- xterm.js theme colors are mapped from NEXUS CSS variables for theme consistency
```

---

## API Endpoints Consumed

This plugin does NOT produce new REST API endpoints. It uses the existing SignalR hub and REST endpoints:

| Type | Route | Source Phase | Usage |
|------|-------|-------------|-------|
| WS | `/hubs/terminal` | Phase 7 | Open, stream, resize, close terminal sessions |
| GET | `/api/machines` | Phase 14 | Machine list for machine selector |
| GET | `/api/machines/{hostname}` | Phase 14 | Machine detail for credential lookup |
| GET | `/api/credentials` | Phase 8 | Credential list for selector dropdown |
| GET | `/api/terminals` | Phase 7 | List active terminal sessions |
| DELETE | `/api/terminals/{sessionId}` | Phase 7 | Force-close a terminal session |
| GET | `/api/plugins/remote-terminal` | Phase 6 | Read plugin config (settings) |

**SignalR Hub Methods Used:**

| Direction | Method | Params | Purpose |
|-----------|--------|--------|---------|
| Client → Hub | `OpenTerminal` | `hostname`, `credentialId` | Start new PS session |
| Client → Hub | `SendInput` | `sessionId`, `data` | Forward keystrokes |
| Client → Hub | `ResizeTerminal` | `sessionId`, `cols`, `rows` | Update PTY size |
| Client → Hub | `CloseTerminal` | `sessionId` | End session gracefully |
| Hub → Client | `TerminalReady` | `sessionId` | Session established |
| Hub → Client | `TerminalOutput` | `sessionId`, `data` | PS output stream |
| Hub → Client | `TerminalClosed` | `sessionId`, `reason` | Session ended |
| Hub → Client | `TerminalError` | `sessionId`, `error` | Connection failure |

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `plugins/remote-terminal/plugin.json` | Create | Full manifest |
| `plugins/remote-terminal/ui/Tool.tsx` | Create | Main terminal page with tabs |
| `plugins/remote-terminal/ui/Settings.tsx` | Create | Terminal settings page |
| `plugins/remote-terminal/ui/types.ts` | Create | TerminalSession, TerminalSettings types |
| `plugins/remote-terminal/ui/components/TerminalView.tsx` | Create | xterm.js wrapper + SignalR binding |
| `plugins/remote-terminal/ui/components/MachineSelector.tsx` | Create | Machine picker dialog |
| `plugins/remote-terminal/ui/components/TabBar.tsx` | Create | Session tab bar |
| `plugins/remote-terminal/ui/components/StatusBar.tsx` | Create | Bottom status bar |
| `plugins/remote-terminal/ui/components/SearchOverlay.tsx` | Create | Ctrl+F search in terminal |
| `plugins/remote-terminal/scripts/test-winrm.ps1` | Create | WinRM connectivity test |
| `plugins/remote-terminal/README.md` | Create | Plugin documentation |

---

## Integration Points

- **Phase 7 (SignalR TerminalHub):** The entire terminal I/O pipeline runs through `TerminalHub`. The `TerminalView` component connects to `/hubs/terminal`, calls `OpenTerminal` to start a session, forwards keystrokes via `SendInput`, and receives output via `TerminalOutput` events. Session cleanup uses `CloseTerminal` and the hub's `OnDisconnectedAsync`.
- **Phase 8 (Credentials):** The `MachineSelector` shows available credential profiles. The selected credential ID is passed to `TerminalHub.OpenTerminal`. If no credential is selected, the machine's default `credential_id` (Phase 14) is used.
- **Phase 12 (Plugin Renderer):** `Tool.tsx` is loaded dynamically at route `/plugins/remote-terminal/terminal`. Receives `NexusPluginContext` with `signalr` manager and `api` client.
- **Phase 14 (Machine Management):** Machine list for the selector comes from `GET /api/machines`. The machine's assigned `credentialId` provides the default authentication.
- **Phase 15 (Machine Overview):** Context menu "Open Terminal" item navigates to `/plugins/remote-terminal/terminal?host={hostname}`, which auto-opens a session. The Plugin Renderer handles cross-plugin navigation.

---

## Test Criteria
- [ ] `plugins/remote-terminal/plugin.json` validates as valid JSON matching Phase 6 schema
- [ ] Plugin appears in `GET /api/plugins` and sidebar shows "Remote Terminal" under System
- [ ] Clicking "Remote Terminal" in sidebar opens the terminal tool page
- [ ] Clicking "+" opens machine selector with all online machines listed
- [ ] Selecting a machine and clicking "Connect" opens a PowerShell session
- [ ] Terminal displays PowerShell prompt (`PS C:\>`) within 3 seconds
- [ ] Typing commands shows real-time keystroke echo and command output
- [ ] `Get-Process | Select -First 5` returns formatted table output correctly
- [ ] Terminal resizes when browser window is resized (columns/rows update)
- [ ] Opening multiple tabs maintains independent sessions
- [ ] Switching tabs preserves terminal scrollback and state
- [ ] Closing a tab sends `CloseTerminal` to hub and removes the tab
- [ ] Closing the browser tab triggers `OnDisconnectedAsync` cleanup on backend
- [ ] `Ctrl+Shift+F` opens search overlay and finds text in scrollback
- [ ] `Ctrl+Shift+C` copies selected terminal text to clipboard
- [ ] `Ctrl+Shift+V` pastes clipboard content into terminal
- [ ] Right-click context menu on machine card shows "Open Terminal" (when plugin loaded)
- [ ] "Open Terminal" from context menu opens new tab for that specific machine
- [ ] "Test WinRM" command runs `test-winrm.ps1` and shows connectivity results
- [ ] Disconnecting network → terminal shows "Reconnecting" → reconnects on restore
- [ ] Settings page changes font size → terminal re-renders with new size immediately
- [ ] Status bar shows correct connection state, hostname, and terminal dimensions
- [ ] Terminal colors match the active NEXUS theme (dark-default, light, cyberpunk, midnight-blue)
- [ ] Max sessions enforced: 6th tab attempt shows "Maximum sessions reached" warning
- [ ] `npm run build` includes plugin components without errors

---

## Sub-Phase Breakdown (if needed)
- **16-0:** `plugin.json` manifest + `README.md` + plugin folder structure + types
- **16-1:** `TerminalView.tsx` — xterm.js initialization + addon loading + theme mapping
- **16-2:** SignalR integration — connect to TerminalHub, open session, stream I/O
- **16-3:** `TabBar.tsx` + `StatusBar.tsx` — session tab management + status display
- **16-4:** `Tool.tsx` — main page wiring tabs + terminal views + state management
- **16-5:** `MachineSelector.tsx` — machine picker dialog with credential dropdown
- **16-6:** `SearchOverlay.tsx` — in-terminal text search via xterm-addon-search
- **16-7:** Keyboard shortcuts (Ctrl+Shift+T/W/F/C/V, Ctrl+Tab)
- **16-8:** `Settings.tsx` — settings page with live preview
- **16-9:** `test-winrm.ps1` script + context menu integration + cross-plugin navigation
- **16-10:** Reconnection handling, error states, max session enforcement, polish

---

## Notes for Coding Agent
- xterm.js must be imported from the packages already installed in Phase 0: `xterm`, `xterm-addon-fit`, `xterm-addon-web-links`. The search addon (`xterm-addon-search`) needs to be added to `package.json` if not already present.
- The `TerminalView` component should NOT create a new SignalR connection per terminal. Use the shared `SignalRManager` from `context.signalr` (Phase 10). The manager handles connection lifecycle and auto-reconnect.
- xterm.js Terminal instance must be attached to a DOM element via `terminal.open(containerElement)`. Use a React `ref` and `useEffect` for lifecycle. Call `FitAddon.fit()` after the container is mounted and on every resize.
- Terminal theme colors: xterm.js has its own `ITheme` interface. Map NEXUS CSS variables to xterm ITheme at initialization AND on theme change. Listen for theme changes via `themeStore` and call `terminal.options.theme = newTheme`.
- Copy/paste: xterm.js handles Ctrl+Shift+C/V natively when `allowProposedApi: true` is set. Standard Ctrl+C sends SIGINT to the PowerShell session — do NOT intercept it.
- Terminal resize: `FitAddon.fit()` calculates cols/rows from container pixel dimensions. After fit, forward the new dimensions to the backend via `hub.ResizeTerminal(sessionId, cols, rows)`. Use `ResizeObserver` on the container, debounced at 100ms.
- Session state on tab switch: do NOT dispose the xterm Terminal when switching tabs. Instead, hide/show the container element. Each tab has its own Terminal instance kept in memory.
- The "Open Terminal" command from context menu is a navigation action, not a script execution. When triggered, navigate to `/plugins/remote-terminal/terminal?host={hostname}&cred={credentialId}`. The Tool component reads query params and auto-opens a session.
- Recently connected machines: store last 5 hostnames in `localStorage` key `nexus.terminal.recent`. Show at top of MachineSelector.
- Connection error handling: if `TerminalError` is received, show an error message in the terminal area (red text on dark background) with the error details and a "Retry" button. Common errors: "Access denied" (wrong credentials), "WinRM not enabled", "Machine offline".
- Backend session limit: Phase 7's TerminalHub enforces max 5 concurrent sessions per user. The frontend should also check before opening and show a warning if the limit is reached.
- The terminal background color should match `--color-bg-primary` for seamless integration. Avoid a visible border between terminal and surrounding UI.
- Tab labels should show the PowerShell window title when available (the backend can forward `$Host.UI.RawUI.WindowTitle` changes). Default to hostname.


