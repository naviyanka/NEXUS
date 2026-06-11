# NEXUS — Master Overview Document
**Network EXecution & Unified Server-hub**

> This is the single source of truth for the NEXUS project.  
> Every phase plan, every plugin, every design decision references back to this file.  
> Coding agents should read this file FIRST before working on any phase.

---

## 1. What is NEXUS?

NEXUS is a self-hosted, browser-based IT control hub for Windows Server lab environments. It is installed as a **Windows Service** on any domain-joined server (typically the DC) and provides a unified web interface to monitor, manage, and automate every machine in the domain — with zero agent installation on target machines.

**Target environment:**
- 1 Domain Controller (DC01)
- 1 SQL Server (SQL01)
- 1 Windows 11 Pro Client (WIN11-CLIENT)
- 3 SharePoint farms (SPSE, SP2019, SP2016), each with 1 WFE + 1 APP server
- All machines: Windows, domain-joined, WinRM-enabled

**Primary users:** IT administrators and lab owners who want Windows Admin Center parity + SharePoint-specific tools + lab-exclusive features in a single, extensible, self-hosted tool.

---

## 2. Core Design Principles

| Principle | Description |
|-----------|-------------|
| **Zero Agent** | Target machines need no software installed. All communication via WinRM/CIM/PS Remoting. |
| **Plugin-First** | Every feature is a plugin. Core app is a shell. Adding a feature = dropping a folder. |
| **Non-Tech Friendly** | Plugin creation requires only filling a JSON file and pasting a PS script. No coding needed. |
| **WAC Parity** | Every feature in Windows Admin Center is replicated as a NEXUS plugin. |
| **NEXUS Exclusive** | Features WAC doesn't have: multi-machine ops, SP config diff, lab snapshot, topology view, etc. |
| **Modular Placement** | Each plugin declares where it renders (dashboard panel, sidebar tool, toolbar widget, context menu). |
| **Theme System** | Full CSS token-based theming. Custom themes = copy a JSON template and change colors. |
| **Single Installer** | One `.exe` produced by Inno Setup. Installs everything. Runs as Windows Service. Domain admin installs in minutes. |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  NEXUS Host Server (domain-joined Windows Server / DC)          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NEXUS Windows Service (nexus.exe)                      │    │
│  │                                                         │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│  │  │  ASP.NET     │  │  Plugin      │  │  Script       │ │    │
│  │  │  Core 8      │  │  Loader      │  │  Executor     │ │    │
│  │  │  (REST API + │  │  (manifest   │  │  (PS1/Py/Bat/ │ │    │
│  │  │  SignalR WS) │  │  hot-reload) │  │  VBS)         │ │    │
│  │  └─────────────┘  └──────────────┘  └───────────────┘ │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│  │  │  WinRM/CIM   │  │  Auth        │  │  SQLite DB    │ │    │
│  │  │  Connection  │  │  (Kerberos + │  │  (audit/jobs/ │ │    │
│  │  │  Pool        │  │  NTLM/Local) │  │  scripts/cfg) │ │    │
│  │  └─────────────┘  └──────────────┘  └───────────────┘ │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│  │  │  DPAPI       │  │  Event Bus   │  │  Cron         │ │    │
│  │  │  Credentials │  │  (plugin     │  │  Scheduler    │ │    │
│  │  │  Vault       │  │  messaging)  │  │               │ │    │
│  │  └─────────────┘  └──────────────┘  └───────────────┘ │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           │ WinRM port 5985/5986               │
│  ┌────────────────────────▼───────────────────────────────┐    │
│  │  Target Machines (NO AGENT REQUIRED)                    │    │
│  │  DC01 │ SQL01 │ SPSE-WFE │ SPSE-APP │ SP2019-* │ WIN11 │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ HTTPS (browser on any network machine)
┌────────┴────────┐
│  React Frontend  │  (served by NEXUS service at https://nexus-host:443)
│  TypeScript +    │
│  Tailwind +      │
│  Zustand state   │
└─────────────────┘
```

---

## 4. Technology Stack

### Backend (Core Gateway)
| Component | Technology | Reason |
|-----------|-----------|--------|
| Language | C# / .NET 8 | Native Windows APIs, Kerberos, DPAPI, WMI, AD |
| Web Framework | ASP.NET Core 8 Minimal API | Fast, lightweight REST + WebSocket |
| Real-time | SignalR (WebSocket) | Live terminal, metrics streaming |
| Auth | Windows Auth (Kerberos/NTLM) + local JWT fallback | Domain-native |
| Database | SQLite via EF Core | Zero config, single file, no SQL Server needed |
| Windows Service | .NET Worker Service | Installs as native Windows Service |
| AD/DNS/DHCP | System.DirectoryServices, DnsClient.NET | Official .NET libraries |
| WinRM | Microsoft.Management.Infrastructure (CIM) | Native, battle-tested |
| Credentials | Windows DPAPI (DataProtectionAPI) | Encrypted at-rest per machine |
| Scheduler | Quartz.NET | Cron-style background jobs |

### Frontend
| Component | Technology |
|-----------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| State | Zustand |
| Styling | Tailwind CSS + CSS Variables (theme tokens) |
| Terminal | xterm.js |
| Charts | Recharts |
| Drag & Drop | @dnd-kit/core |
| Icons | Lucide React |
| HTTP | Axios |
| WebSocket | SignalR JS client |

### Scripts (Plugin-side, not core)
- PowerShell 5.1 / 7+ (.ps1)
- Python 3.x (.py)
- Batch (.bat / .cmd)
- VBScript (.vbs)

---

## 5. Repository Structure

```
NEXUS/
│
├── src/
│   ├── Nexus.Gateway/              ← .NET 8 Windows Service (main backend)
│   │   ├── Program.cs              ← Service entry point
│   │   ├── Startup.cs              ← DI, middleware, routing
│   │   ├── Core/
│   │   │   ├── PluginLoader.cs     ← Discovers & loads plugin manifests
│   │   │   ├── ScriptExecutor.cs   ← Runs PS/Py/Bat/VBS
│   │   │   ├── WinRmClient.cs      ← WinRM/CIM connection pool
│   │   │   ├── AuthService.cs      ← Kerberos/NTLM/Local auth
│   │   │   ├── CredentialVault.cs  ← DPAPI encryption
│   │   │   ├── EventBus.cs         ← Plugin-to-plugin messaging
│   │   │   └── Scheduler.cs        ← Quartz.NET cron jobs
│   │   ├── Data/
│   │   │   ├── NexusDbContext.cs   ← EF Core SQLite context
│   │   │   └── Migrations/
│   │   ├── Models/                 ← Shared DTOs & domain models
│   │   ├── Hubs/
│   │   │   ├── TerminalHub.cs      ← SignalR: live terminal
│   │   │   └── MetricsHub.cs       ← SignalR: real-time metrics
│   │   └── Controllers/            ← REST API endpoints
│   │
│   └── Nexus.Frontend/             ← React + TypeScript frontend
│       ├── src/
│       │   ├── shell/
│       │   │   ├── Layout.tsx          ← Topbar + Sidebar + Content
│       │   │   ├── PluginRenderer.tsx  ← Renders any plugin component
│       │   │   ├── ThemeProvider.tsx   ← Injects CSS token variables
│       │   │   └── DashboardGrid.tsx   ← @dnd-kit drag-drop grid
│       │   ├── store/
│       │   │   ├── machineStore.ts     ← Zustand: machine state
│       │   │   ├── pluginStore.ts      ← Zustand: loaded plugins
│       │   │   └── themeStore.ts       ← Zustand: active theme
│       │   ├── hooks/
│       │   │   ├── useWinRM.ts
│       │   │   ├── useMachine.ts
│       │   │   └── useSignalR.ts
│       │   ├── lib/
│       │   │   ├── api.ts              ← Axios API client
│       │   │   └── signalr.ts          ← SignalR connection manager
│       │   └── types/                  ← TypeScript interfaces
│       └── vite.config.ts
│
├── plugins/                        ← All plugins live here
│   ├── machine-overview/           ← Built-in
│   ├── remote-terminal/            ← Built-in
│   ├── service-manager/            ← Built-in
│   ├── script-runner/              ← Built-in
│   ├── ...                         ← All 54 plugins
│   └── _template/                  ← Copy this to create new plugin
│
├── themes/                         ← All themes live here
│   ├── dark-default/
│   ├── light/
│   ├── cyberpunk/
│   ├── midnight-blue/
│   └── _template/
│
├── config/
│   ├── machines.yaml               ← All machines + groups + tags
│   ├── nexus.yaml                  ← Global app settings
│   └── credentials.yaml            ← Encrypted (DPAPI, never plaintext)
│
├── installer/
│   ├── nexus-setup.iss             ← Inno Setup script
│   └── build-installer.ps1         ← Produces NEXUS-Setup.exe
│
├── docs/                           ← Documentation
└── tests/                          ← Unit + integration tests
    ├── Nexus.Gateway.Tests/
    └── Nexus.Frontend.Tests/
```

---

## 6. Plugin System

### Plugin Folder Structure
```
plugins/my-plugin/
├── plugin.json          ← REQUIRED: Plugin manifest (brain of the plugin)
├── scripts/
│   ├── action.ps1       ← PowerShell script (preferred)
│   ├── action.py        ← Python alternative
│   └── action.bat       ← Batch alternative
├── ui/
│   ├── Panel.tsx        ← Optional custom React panel
│   ├── Tool.tsx         ← Optional sidebar tool view
│   └── Widget.tsx       ← Optional toolbar widget
└── README.md            ← Plugin documentation
```

### plugin.json Schema
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What it does",
  "version": "1.0.0",
  "author": "Name",
  "category": "System|Network|Storage|AD|SharePoint|Security|Meta",
  "icon": "server",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "panels": [
      {
        "id": "main-panel",
        "title": "My Panel",
        "component": "ui/Panel",
        "size": { "w": 6, "h": 4 },
        "resizable": true,
        "refresh_interval": 30,
        "data_source": "api/my-plugin/data"
      }
    ],
    "tools": [
      {
        "id": "main-tool",
        "title": "My Tool",
        "icon": "wrench",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 5
      }
    ],
    "widgets": [
      {
        "id": "status-widget",
        "title": "Status",
        "position": "toolbar_right",
        "component": "ui/Widget"
      }
    ],
    "commands": [
      {
        "id": "my-plugin.run",
        "title": "Run Action",
        "icon": "play",
        "scripts": {
          "powershell": "scripts/action.ps1",
          "python":     "scripts/action.py",
          "batch":      "scripts/action.bat"
        },
        "default_script": "powershell",
        "target": "single|multi|group|all",
        "parallel": true,
        "confirm": true,
        "confirm_message": "Are you sure?"
      }
    ],
    "menus": [
      { "location": "dashboard_toolbar", "command": "my-plugin.run" },
      { "location": "machine_context_menu", "when": "machine.tags includes 'iis'", "command": "my-plugin.run" }
    ],
    "settings_page": {
      "id": "my-plugin-settings",
      "title": "My Plugin Settings",
      "component": "ui/Settings"
    }
  },

  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },

  "config_schema": {
    "check_interval": {
      "type": "number",
      "default": 30,
      "label": "Check interval (seconds)"
    }
  }
}
```

### UI Placement Slots
| Slot | Description |
|------|-------------|
| `dashboard` | Drag-drop panel on main dashboard |
| `sidebar_tool` | Full-page tool in left sidebar |
| `toolbar_left` | Small widget in top-left toolbar |
| `toolbar_right` | Small widget in top-right toolbar |
| `machine_context_menu` | Right-click menu item on machine card |
| `dashboard_toolbar` | Button/dropdown above dashboard grid |
| `quick_actions` | Floating action bar (bottom of screen) |

---

## 7. Theme System

### Theme Folder Structure
```
themes/my-theme/
├── theme.json       ← Design tokens (colors, fonts, spacing, effects)
├── overrides.css    ← Optional raw CSS overrides
├── preview.png      ← 320x200 screenshot for theme picker
└── README.md
```

### theme.json Schema
Defines CSS variables injected at runtime. Three built-in base themes: `dark`, `light`, `system`.

Key token groups:
- `color.*` — background, surface, border, accent, text, status colors
- `font.*` — family-ui, family-mono, sizes, weights
- `space.*` — xs/sm/md/lg/xl spacing scale
- `radius.*` — border radius scale
- `shadow.*` — box-shadow presets
- `transition.*` — animation speed
- `effects.*` — glow, blur, glassmorphism, animated borders (boolean)
- `layout.*` — sidebar width, topbar height, card gap

---

## 8. Configuration Files

### config/machines.yaml
```yaml
groups:
  - id: SP-SPSE
    label: "SharePoint SE"
    color: "#00ff9f"
    machines: [SPSE-WFE01, SPSE-APP01]

machines:
  - hostname: DC01
    display_name: "Domain Controller"
    tags: [dc, dns, dhcp, adds]
    icon: shield
    credential_id: domain-admin

  - hostname: SPSE-WFE01
    display_name: "SPSE Web Front End"
    group: SP-SPSE
    role: WFE
    tags: [sharepoint, spse, wfe, iis]
    icon: sharepoint
```

### config/nexus.yaml
```yaml
service:
  port: 443
  host: 0.0.0.0
  ssl: true

auth:
  mode: windows   # windows | local | both
  session_timeout_minutes: 480

plugins:
  directory: ./plugins
  hot_reload: true

themes:
  directory: ./themes
  active: dark-default

database:
  path: ./data/nexus.db

logging:
  level: Information
  path: ./logs/nexus.log
```

---

## 9. Complete Plugin Catalog

### WAC Parity Plugins (26 plugins)
| # | Plugin ID | Category | Priority |
|---|-----------|----------|----------|
| 1 | machine-overview | System | P1 Core |
| 2 | remote-terminal | System | P1 Core |
| 3 | remote-desktop | System | P1 Core |
| 4 | service-manager | System | P1 Core |
| 5 | event-viewer | System | P1 Core |
| 6 | process-manager | System | P1 Core |
| 7 | file-browser | System | P2 Important |
| 8 | windows-update | System | P2 Important |
| 9 | performance-monitor | System | P1 Core |
| 10 | scheduled-tasks | System | P2 Important |
| 11 | certificate-manager | Security | P2 Important |
| 12 | firewall-manager | Security | P2 Important |
| 13 | registry-editor | System | P2 Important |
| 14 | local-users-groups | System | P2 Important |
| 15 | installed-apps | System | P2 Important |
| 16 | network-adapters | Network | P2 Important |
| 17 | dhcp-manager | Network | P2 Important |
| 18 | dns-manager | Network | P2 Important |
| 19 | roles-features | System | P2 Important |
| 20 | storage-manager | Storage | P2 Important |
| 21 | devices-manager | System | P3 Nice |
| 22 | defender-integration | Security | P2 Important |
| 23 | security-settings | Security | P2 Important |
| 24 | security-baseline | Security | P3 Nice |
| 25 | windows-laps | Security | P3 Nice |
| 26 | active-directory | AD | P1 Core |

### NEXUS Exclusive Plugins (20 plugins)
| # | Plugin ID | Category | Priority |
|---|-----------|----------|----------|
| 27 | script-runner | Meta | P1 Core |
| 28 | script-library | Meta | P1 Core |
| 29 | machine-groups | Meta | P1 Core |
| 30 | bulk-operations | Meta | P1 Core |
| 31 | alert-manager | Meta | P1 Core |
| 32 | audit-log | Meta | P1 Core |
| 33 | lab-topology | NEXUS | P2 Important |
| 34 | lab-snapshot | NEXUS | P2 Important |
| 35 | cross-machine-search | NEXUS | P2 Important |
| 36 | comparison-view | NEXUS | P2 Important |
| 37 | session-manager | NEXUS | P2 Important |
| 38 | performance-baseline | NEXUS | P2 Important |
| 39 | bulk-patch-manager | NEXUS | P2 Important |
| 40 | command-palette | NEXUS | P2 Important |

### SharePoint Plugins (8 plugins)
| # | Plugin ID | Category | Priority |
|---|-----------|----------|----------|
| 41 | sp-farm-health | SharePoint | P1 Core |
| 42 | sp-service-status | SharePoint | P1 Core |
| 43 | sp-iis-manager | SharePoint | P1 Core |
| 44 | sp-distributed-cache | SharePoint | P2 Important |
| 45 | sp-uls-viewer | SharePoint | P2 Important |
| 46 | sp-config-diff | SharePoint | P2 Important |
| 47 | sp-upgrade-checker | SharePoint | P2 Important |
| 48 | sp-app-pool-manager | SharePoint | P2 Important |

### Meta / Settings Plugins (4 plugins)
| # | Plugin ID | Category | Priority |
|---|-----------|----------|----------|
| 49 | plugin-manager | Meta | P1 Core |
| 50 | theme-manager | Meta | P1 Core |
| 51 | credentials-manager | Meta | P1 Core |
| 52 | nexus-settings | Meta | P1 Core |

**Total: 52 plugins**

---

## 10. Complete Phase Plan (Overview)

| Phase | Title | Area | Depends On |
|-------|-------|------|-----------|
| 0 | Repository Structure & Solution Setup | Infrastructure | — |
| 1 | .NET 8 Windows Service Gateway | Infrastructure | 0 |
| 2 | WinRM / CIM Connection Engine | Infrastructure | 1 |
| 3 | Script Executor (PS/Python/Bat/VBS) | Infrastructure | 1,2 |
| 4 | Authentication System | Infrastructure | 1 |
| 5 | SQLite Database Layer | Infrastructure | 1 |
| 6 | Plugin Loader System | Infrastructure | 1,5 |
| 7 | WebSocket Engine (SignalR) | Infrastructure | 1 |
| 8 | Credentials Manager (DPAPI) | Infrastructure | 1,5 |
| 9 | Event Bus & Scheduler | Infrastructure | 1,5 |
| 10 | React Frontend Shell | Frontend | 1 |
| 11 | Theme Engine | Frontend | 10 |
| 12 | Plugin Renderer System | Frontend | 10,6 |
| 13 | Dashboard Grid Engine | Frontend | 10,12 |
| 14 | Machine & Group Management | Frontend+Backend | 2,10 |
| 15 | Machine Overview Plugin | Plugin | 14 |
| 16 | Remote Terminal Plugin | Plugin | 7,15 |
| 17 | Service Manager Plugin | Plugin | 2,15 |
| 18 | Script Runner & Library Plugin | Plugin | 3,15 |
| 19 | Performance Monitor Plugin | Plugin | 2,15 |
| 20 | Event Viewer Plugin | Plugin | 2,15 |
| 21 | Process Manager Plugin | Plugin | 2,15 |
| 22 | File Browser Plugin | Plugin | 2,15 |
| 23 | Windows Update Plugin | Plugin | 3,15 |
| 24 | Scheduled Tasks Plugin | Plugin | 2,15 |
| 25 | Certificate Manager Plugin | Plugin | 2,15 |
| 26 | Firewall Manager Plugin | Plugin | 3,15 |
| 27 | Registry Editor Plugin | Plugin | 2,15 |
| 28 | Local Users & Groups Plugin | Plugin | 2,15 |
| 29 | Network, Roles & Storage Plugins | Plugin | 2,15 |
| 30 | Active Directory Plugin (Full) | Plugin | 2,15 |
| 31 | DNS Manager Plugin | Plugin | 2,15 |
| 32 | DHCP Manager Plugin | Plugin | 2,15 |
| 33 | Defender & Security Baseline Plugin | Plugin | 3,15 |
| 34 | SharePoint Farm Health Plugin | Plugin | 3,15 |
| 35 | SharePoint Services & IIS Plugin | Plugin | 34 |
| 36 | SharePoint Dist. Cache & ULS Plugin | Plugin | 34 |
| 37 | SharePoint Config Diff & Upgrade Checker | Plugin | 34 |
| 38 | NEXUS Exclusive Plugins Batch 1 | Plugin | 15,18 |
| 39 | NEXUS Exclusive Plugins Batch 2 | Plugin | 15,18 |
| 40 | Plugin Manager & Theme Manager UI | Meta | All plugins |
| 41 | Alert Manager & Audit Log Plugin | Meta | 5,9 |
| 42 | Installer (Inno Setup → NEXUS-Setup.exe) | Installer | All |
| 43 | Testing & Quality Assurance | Testing | All |
| 44 | Documentation & Deployment Guide | Docs | All |

---

## 11. UI Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ [NEXUS]  [SP-Status ●] [3/9 Online]    [🔔 Alerts] [⚙] [Theme] │  ← Topbar
├─────────────────┬────────────────────────────────────────────────┤
│                 │                                                 │
│  📊 Dashboard   │  ┌─ Machine Grid ──────────────────────────┐  │
│  🖥️ Machines     │  │  DC01 ● │ SQL01 ● │ WIN11 ●            │  │
│                 │  │  SPSE-WFE ● │ SPSE-APP ● │ ...          │  │
│  ─── SharePoint │  └─────────────────────────────────────────┘  │
│  ├ Farms        │  ┌─ SP Farm Health ─────┐ ┌─ Alerts ────────┐│
│  ├ Services     │  │  SPSE   ● Healthy    │ │ 0 Critical       ││
│  ├ IIS          │  │  SP2019 ● Healthy    │ │ 1 Warning        ││
│  ├ Dist. Cache  │  │  SP2016 ⚠ Warning   │ └─────────────────┘│
│  └ ULS Logs     │  └──────────────────────┘                     │
│                 │  ┌─ Script Runner ───────────────────────────┐│
│  ─── Scripts    │  │  [▶ Run] [Target: All ▼] [SP-SPSE] [...]  ││
│  📅 Scheduler   │  └───────────────────────────────────────────┘│
│  🔔 Alerts      │                                                 │
│  📋 Audit Log   │      Drag-drop panels — any plugin goes here   │
│                 │                                                 │
│  ─── Settings   │                                                 │
│  ⚙ NEXUS       │                                                 │
│  🎨 Themes      │                                                 │
│  🧩 Plugins     │                                                 │
│  🔑 Credentials │                                                 │
└─────────────────┴────────────────────────────────────────────────┘
     Sidebar (240px)              Main Content (drag-drop)
```

---

## 12. Key API Endpoints (Reference)

```
GET    /api/machines                     → All machine statuses
GET    /api/machines/{id}                → Single machine detail
POST   /api/machines/{id}/ping           → Ping machine
GET    /api/plugins                      → List loaded plugins
POST   /api/scripts/run                  → Execute script on targets
GET    /api/scripts/library              → Saved script library
GET    /api/audit-log                    → Audit log entries
GET    /api/alerts                       → Active alerts
GET    /api/credentials                  → Credential profiles (names only)
POST   /api/credentials                  → Add credential
GET    /api/themes                       → Available themes
GET    /api/dashboard/layout             → Saved layout
PUT    /api/dashboard/layout             → Save layout

WS     /hubs/terminal/{machineId}        → SignalR: remote terminal
WS     /hubs/metrics                     → SignalR: live CPU/RAM/Disk
WS     /hubs/alerts                      → SignalR: real-time alerts
```

---

## 13. Sub-Phase Convention

Each major phase (e.g., Phase 0) can be broken into sub-phases on demand:

```
Phase 0   → Phase 0-0, Phase 0-1, Phase 0-2, Phase 0-3, Phase 0-4
Phase 1   → Phase 1-0, Phase 1-1, Phase 1-2, Phase 1-3
...
```

Sub-phases follow the same document format as full phases. Request any sub-phase breakdown when ready to start coding that specific phase.

---

## 14. Development Workflow for Coding Agents

1. **Always read this master file first** for full context
2. Read the specific phase file you are implementing
3. Never modify `src/Nexus.Gateway/Core/` files unless the phase explicitly targets them
4. Plugin code lives in `plugins/{plugin-id}/` — never in core
5. Frontend shell code lives in `src/Nexus.Frontend/src/shell/` — don't touch unless phase targets it
6. Each phase ends with a working, testable deliverable — no half-finished states
7. Run the test criteria at the end of each phase before marking complete
8. Reference `NEXUS-MASTER.md` for any architectural decision

---

## 🔗 Third-Party Integrations (Approved — Use Instead of Building From Scratch)

| Integration | Replaces | How To Use |
|---|---|---|
| **satnaing/shadcn-admin** (MIT, 10.9k⭐) | Phase 23–26 custom shell build | Fork → strip demo pages → build NEXUS on top |
| **shadcn/ui login blocks** (MIT, free) | Custom auth page UI | `npx shadcn add login-01` |
| **shadcn/ui component library** (MIT) | All custom UI components in Phase 26 | `npx shadcn add button card table badge modal...` |
| **Magic UI** (MIT) | Dashboard animations | `npm install magic-ui` |
| **guacamole-lite + guacd** (Apache 2.0) | Building browser RDP protocol | `npm install guacamole-lite`, run guacd daemon on NEXUS server |
| **guacamole-common-js** (Apache 2.0) | RDP canvas in React | `npm install @guacamole/common-js` |
| **amidaware/community-scripts** (source-available) | Writing all plugin PS1/Py/Bat scripts | Copy from `github.com/amidaware/community-scripts/scripts/` |
| **Microsoft.AspNetCore.Authentication.Negotiate** (MIT) | Building Kerberos/NTLM auth from scratch | `dotnet add package Microsoft.AspNetCore.Authentication.Negotiate` — one line |

### satnaing/shadcn-admin Fork Strategy
```
1. git clone https://github.com/satnaing/shadcn-admin.git src/NEXUS.Frontend
2. Strip: demo pages (apps/tasks/users/chats), fake data, mock auth
3. Keep: AppShell, Sidebar, Topbar, Command Palette, ThemeProvider, 
         sign-in page, React Router setup, shadcn components, Lucide icons
4. Add: NEXUS plugin renderer, machine store, SignalR client,
         dashboard grid, NEXUS theme tokens, backend API wiring
```

### TRMM Community Scripts — Built-in Script Library Seed
```
Source: github.com/amidaware/community-scripts/scripts/
Copy scripts tagged: [windows], category contains disk/services/patching/cleanup
Rename to NEXUS naming convention, add to plugins/script-library/scripts/
These become the default seeded scripts in Phase 17 DatabaseSeeder
```
___

*Last updated: June 2026 — NEXUS v1.0 Planning Phase*