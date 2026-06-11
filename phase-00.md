# Phase 0 — Repository Structure & Solution Setup

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Establish the complete repository skeleton, solution structure, and foundational project files so every subsequent phase has a consistent home. No functional code in this phase — only structure, scaffolding, and config.

---

## Context: What is NEXUS?
NEXUS (Network EXecution & Unified Server-hub) is a self-hosted, browser-based IT control hub installed as a Windows Service on a domain controller. It manages all domain-joined machines agentlessly via WinRM/CIM. Backend: .NET 8 ASP.NET Core. Frontend: React 18 + TypeScript. Plugins: drop-a-folder system. Themes: JSON token files. Single `.exe` installer.

---

## Scope
**In scope:**
- .NET 8 solution file with all project references wired
- React + TypeScript + Vite frontend project
- Config file templates (machines.yaml, nexus.yaml)
- Plugin template folder (`_template`)
- Theme template folder (`_template`)
- `.gitignore`, `.editorconfig`, `README.md`
- GitHub Actions CI skeleton (build only, no deploy)
- Directory structure exactly as defined in NEXUS-MASTER.md §5

**Out of scope:**
- Any actual C# logic (Phase 1+)
- Any actual React components (Phase 10+)
- Plugin implementations (Phase 15+)

---

## Prerequisites
- .NET 8 SDK installed
- Node.js 20+ installed
- Git initialized

---

## Detailed Tasks

### 1. Create Solution & .NET Projects
```bash
# Create solution
dotnet new sln -n Nexus

# Create backend project (Worker Service = Windows Service capable)
dotnet new worker -n Nexus.Gateway -o src/Nexus.Gateway
dotnet sln add src/Nexus.Gateway/Nexus.Gateway.csproj

# Create test project
dotnet new xunit -n Nexus.Gateway.Tests -o tests/Nexus.Gateway.Tests
dotnet sln add tests/Nexus.Gateway.Tests/Nexus.Gateway.Tests.csproj

# Add project reference
dotnet add tests/Nexus.Gateway.Tests reference src/Nexus.Gateway/Nexus.Gateway.csproj
```

### 2. Add Required NuGet Packages to Gateway
```xml
<!-- src/Nexus.Gateway/Nexus.Gateway.csproj — add these PackageReferences -->
<PackageReference Include="Microsoft.AspNetCore.SignalR" Version="8.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.*" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.*" />
<PackageReference Include="Microsoft.Extensions.Hosting.WindowsServices" Version="8.*" />
<PackageReference Include="Quartz.Extensions.Hosting" Version="3.*" />
<PackageReference Include="YamlDotNet" Version="15.*" />
<PackageReference Include="System.Management.Automation" Version="7.*" />
```

### 3. Create React Frontend Project
```bash
cd src
npm create vite@latest Nexus.Frontend -- --template react-ts
cd Nexus.Frontend
npm install
npm install zustand axios @microsoft/signalr
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install recharts xterm xterm-addon-fit xterm-addon-web-links
npm install lucide-react
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

### 4. Create Directory Structure
```
NEXUS/
├── src/
│   ├── Nexus.Gateway/
│   │   ├── Core/               ← create empty folder + .gitkeep
│   │   ├── Data/               ← create empty folder + .gitkeep
│   │   ├── Models/             ← create empty folder + .gitkeep
│   │   ├── Hubs/               ← create empty folder + .gitkeep
│   │   └── Controllers/        ← create empty folder + .gitkeep
│   └── Nexus.Frontend/
│       └── src/
│           ├── shell/          ← create empty folder + .gitkeep
│           ├── store/          ← create empty folder + .gitkeep
│           ├── hooks/          ← create empty folder + .gitkeep
│           ├── lib/            ← create empty folder + .gitkeep
│           └── types/          ← create empty folder + .gitkeep
├── plugins/
│   └── _template/              ← see below for contents
├── themes/
│   └── _template/              ← see below for contents
├── config/                     ← template YAML files
├── installer/                  ← empty + .gitkeep
├── docs/                       ← empty + .gitkeep
└── tests/
```

### 5. Create Plugin Template (`plugins/_template/`)
```
plugins/_template/
├── plugin.json         ← Full schema with comments (see NEXUS-MASTER.md §6)
├── scripts/
│   ├── action.ps1      ← Sample PowerShell stub
│   ├── action.py       ← Sample Python stub
│   └── action.bat      ← Sample Batch stub
├── ui/
│   ├── Panel.tsx       ← Stub React component
│   └── Tool.tsx        ← Stub React component
└── README.md           ← Instructions for plugin authors
```

`plugin.json` stub:
```json
{
  "id": "REPLACE-ME",
  "name": "Plugin Name",
  "description": "What does this plugin do?",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "System",
  "icon": "terminal",
  "min_nexus_version": "1.0.0",
  "contributes": {
    "panels": [],
    "tools": [],
    "widgets": [],
    "commands": [],
    "menus": []
  },
  "permissions": {
    "winrm": true,
    "domain_admin": false,
    "run_scripts": true
  },
  "config_schema": {}
}
```

### 6. Create Theme Template (`themes/_template/`)
```
themes/_template/
├── theme.json      ← Full token schema with all required keys
├── overrides.css   ← Empty CSS file with comment guide
├── preview.png     ← 320x200 placeholder image
└── README.md       ← Instructions for theme authors
```

### 7. Create Config Templates

**config/machines.yaml:**
```yaml
# NEXUS Machine Configuration
# Add all your domain machines here.
# Restart NEXUS after editing this file (or trigger hot-reload from Settings).

groups:
  - id: SP-SPSE
    label: "SharePoint SE"
    color: "#00ff9f"
    machines: [SPSE-WFE01, SPSE-APP01]

  - id: SP-2019
    label: "SharePoint 2019"
    color: "#00cfff"
    machines: [SP2019-WFE01, SP2019-APP01]

  - id: SP-2016
    label: "SharePoint 2016"
    color: "#ff9f00"
    machines: [SP2016-WFE01, SP2016-APP01]

machines:
  - hostname: DC01
    display_name: "Domain Controller"
    tags: [dc, dns, dhcp, adds]
    icon: shield
    credential_id: domain-admin

  - hostname: SQL01
    display_name: "SQL Server"
    tags: [sql, database]
    icon: database
    credential_id: domain-admin

  - hostname: WIN11-CLIENT
    display_name: "Windows 11 Client"
    tags: [client, desktop]
    icon: monitor
    credential_id: domain-admin

  - hostname: SPSE-WFE01
    display_name: "SPSE Web Front End"
    group: SP-SPSE
    role: WFE
    tags: [sharepoint, spse, wfe, iis]
    icon: sharepoint
    credential_id: domain-admin
```

**config/nexus.yaml:**
```yaml
service:
  port: 443
  host: 0.0.0.0
  ssl: true
  ssl_cert_path: ""   # Leave empty to auto-generate self-signed

auth:
  mode: windows       # windows | local | both
  session_timeout_minutes: 480
  allowed_groups: []  # Empty = any authenticated domain user

plugins:
  directory: ./plugins
  hot_reload: true

themes:
  directory: ./themes
  active: dark-default

database:
  path: ./data/nexus.db

scheduler:
  enabled: true
  timezone: "UTC"

logging:
  level: Information
  path: ./logs/nexus.log
  max_size_mb: 100
  retain_days: 30
```

### 8. Create .gitignore
Include standard .NET + Node.js + secrets patterns:
```
# .NET
bin/
obj/
*.user
*.suo
.vs/

# Node
node_modules/
dist/
.env

# NEXUS sensitive
config/credentials.yaml
data/
logs/

# OS
.DS_Store
Thumbs.db
```

### 9. Create GitHub Actions CI Skeleton
`.github/workflows/build.yml`:
```yaml
name: NEXUS Build

on: [push, pull_request]

jobs:
  build-backend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.x' }
      - run: dotnet restore
      - run: dotnet build --no-restore
      - run: dotnet test --no-build

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd src/Nexus.Frontend && npm ci && npm run build
```

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `Nexus.sln` | Create | dotnet sln |
| `src/Nexus.Gateway/Nexus.Gateway.csproj` | Create | Worker service template |
| `src/Nexus.Frontend/` | Create | Vite React-TS template |
| `plugins/_template/plugin.json` | Create | Full schema with comments |
| `plugins/_template/scripts/action.ps1` | Create | Stub script |
| `themes/_template/theme.json` | Create | Full token schema |
| `config/machines.yaml` | Create | Sample with dev machines |
| `config/nexus.yaml` | Create | Default app config |
| `.gitignore` | Create | .NET + Node + secrets |
| `README.md` | Create | Project overview |
| `.github/workflows/build.yml` | Create | CI skeleton |

---

## Test Criteria
- [ ] `dotnet build` succeeds with no errors
- [ ] `cd src/Nexus.Frontend && npm run build` succeeds
- [ ] `dotnet test` reports 0 test failures (no tests yet = pass)
- [ ] All directories from NEXUS-MASTER.md §5 exist
- [ ] `plugins/_template/plugin.json` validates as valid JSON
- [ ] `config/machines.yaml` parses without errors
- [ ] `config/nexus.yaml` parses without errors
- [ ] `.gitignore` excludes `config/credentials.yaml` and `data/`

---

## Sub-Phase Breakdown (if needed)
- **0-0:** Solution + .NET project creation
- **0-1:** Frontend project creation + package install
- **0-2:** Plugin template + Theme template
- **0-3:** Config YAML templates + .gitignore
- **0-4:** CI/CD skeleton + README

---

## Notes for Coding Agent
- Do NOT write any C# logic in this phase — stubs and project structure only
- The `Nexus.Gateway` project type must be `Worker Service`, not `Web API` — it needs to run as Windows Service
- `plugins/` and `themes/` directories must be at repo root level, NOT inside `src/`
- `config/credentials.yaml` must be in `.gitignore` — it will contain encrypted credentials
- Frontend uses Vite, NOT Create React App
- Use .NET 8 specifically, not .NET 6 or 7
