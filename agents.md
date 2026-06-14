# NEXUS — Agent Instructions

> This file is read automatically by Jules and other AI coding agents.
> Read this FULLY before touching any file in the repo.

-----

## What is NEXUS?

NEXUS is a self-hosted, browser-based IT control hub for Windows Server lab environments.
It is a Windows Admin Center (WAC) replacement with deep SharePoint-specific features.
It is NOT a SaaS product. It runs on-premises as a Windows Service.

-----

## Repository Structure

```
/
├── src/
│   ├── Nexus.Gateway/          # ASP.NET Core 8 backend (Windows Service)
│   │   ├── Controllers/        # API controllers (all use [Authorize])
│   │   ├── Hubs/               # SignalR hubs (TerminalHub, MetricsHub, AlertsHub)
│   │   ├── Core/               # ScriptExecutor, WinRmConnectionPool, AuditLogger
│   │   ├── Data/               # NexusDbContext, DatabaseSeeder
│   │   ├── Models/             # EF Core entities
│   │   ├── Services/           # VaultService (DPAPI), MetricsPollingService
│   │   ├── Plugins/            # PluginLoader
│   │   └── plugins/            # Plugin manifests (plugin.json per plugin)
│   └── Nexus.Frontend/         # React 18 + TypeScript + Vite + shadcn/ui
│       └── src/
│           ├── features/       # Page-level components (dashboard, machines, terminal, etc.)
│           ├── routes/         # TanStack Router route files
│           ├── stores/         # Zustand stores (authStore, machineStore, pluginStore)
│           ├── hooks/          # Custom hooks (useTerminalSession, useMetrics, etc.)
│           ├── types/          # TypeScript type definitions (one file per domain)
│           └── lib/            # axios instance, signalr helpers, utils
├── PlanV2/                     # Source of truth — READ MASTER_PLAN_V2.md FIRST
│   ├── MASTER_PLAN_V2.md       # Full feature spec + architecture
│   ├── PHASE_INDEX_V2.md       # Phase breakdown
│   ├── ADRS/                   # Architecture Decision Records
│   └── PHASE_COMPLETION_REPORT_*.md
├── tests/
│   ├── Nexus.Gateway.Tests/    # xUnit backend tests
│   └── Nexus.Frontend.Tests/   # Playwright e2e tests
├── NexusInstaller.iss          # Inno Setup installer script
├── build.ps1                   # Full build script
├── global.json                 # .NET SDK version pin (8.x)
└── agents.md                   # ← You are here
```

-----

## Environment Setup

### Backend

- Runtime: **.NET 8** (`net8.0-windows` — Windows-only, required for DPAPI + WMI)
- SDK: Pinned in `global.json` — must be 8.x
- Build: `dotnet build src/Nexus.Gateway/Nexus.Gateway.csproj`
- Test: `dotnet test tests/Nexus.Gateway.Tests/`
- **CRITICAL**: All NuGet packages must be version **8.x.x** or lower.
  Do NOT use any `10.x` or `9.x` packages — they require .NET 10/9 and will break the build.
- SignalR is part of the ASP.NET Core shared framework — do NOT add `Microsoft.AspNetCore.SignalR`
  as a NuGet package. It will cause a restore failure.

### Frontend

- Runtime: Node.js 18+ (Jules VM has Node 22 — that’s fine)
- Package manager: npm
- Build: `cd src/Nexus.Frontend && npm install && npm run build`
- Dev: `npm run dev`
- TypeScript strict mode is ON — no `any` types allowed
- Required packages already in package.json:
  - react 18, typescript, vite, tailwindcss v4
  - @tanstack/react-router, @tanstack/react-query
  - zustand, recharts, shadcn/ui, lucide-react
  - @microsoft/signalr, xterm, xterm-addon-fit
  - @dnd-kit/core, @dnd-kit/sortable
  - @tabler/icons-react

### Both builds must pass before any task is considered complete.

-----

## Architecture Rules (Non-Negotiable)

### Backend Rules

1. **Authentication**: Windows Negotiate ONLY. No JWT, no cookies, no Clerk, no OAuth.
   Every controller must have `[Authorize]` attribute.
   `Program.cs` uses `AddAuthentication().AddNegotiate()` + `AddAuthorization()`.
1. **No mocked data**: Never return hardcoded arrays or fake objects from controllers.
   If real WinRM implementation isn’t possible for a task, say so explicitly — do NOT silently fake it.
1. **WinRM execution**: Always use `ScriptExecutor.ExecutePowerShellAsync()` for PS remoting.
   `WSManConnectionInfo` with `AuthenticationMechanism.Negotiate`.
   Port 5985 (HTTP) default, 5986 (HTTPS) optional.
1. **Audit logging**: Every write action (Start/Stop/Kill/Reset/Install) must call `AuditLogger.LogAsync()`.
1. **Database**: SQLite via EF Core. `NexusDbContext` is the only DbContext.
   Tables: Machine, MachineGroup, AuditLog, SavedScript, Credential, Alert, JobHistory.
   `Database.EnsureCreated()` on startup. `DatabaseSeeder` runs if tables are empty.
1. **VaultService**: DPAPI-based credential encryption. Uses `ProtectedData.Protect()`.
   Credentials stored by key in SQLite `Credential` table — NOT as a single flat file.
1. **SignalR Hubs**:
- `/hubs/terminal` — `TerminalHub` — real PS runspace per connection
- `/hubs/metrics` — `MetricsHub` — streamed CPU/RAM/Disk per machine
- `/hubs/alerts` — `AlertsHub` — real-time alert notifications

### Frontend Rules

1. **Auth flow**: NO login form. Windows Negotiate means browser auto-sends credentials.
   On app init → call `GET /api/auth/me` with `withCredentials: true`.
   If 401 → show AccessDenied component. NOT a redirect to /sign-in.
   Clerk is NOT used. Delete any Clerk imports if found.
1. **No `any` types**: All TypeScript must be strictly typed.
   Type definitions live in `src/types/` — one file per domain.
1. **Data fetching**: TanStack Query for all REST calls. Zustand for UI state only.
1. **Real-time**: `@microsoft/signalr` HubConnection for MetricsHub and TerminalHub.
1. **Routing**: TanStack Router. All NEXUS routes live under `src/routes/_authenticated/`.
1. **UI components**: shadcn/ui + Tailwind CSS v4. lucide-react for icons.
   Dark theme is default. No light-only designs.
1. **Loading states**: Every data-fetching component must show shadcn `Skeleton` while loading.
   Empty states must be meaningful (not blank) — explain what to do next.

-----

## Target Lab Machines (Pre-seeded in DB)

|Hostname    |Role                             |Group          |
|------------|---------------------------------|---------------|
|DC01        |Domain Controller (DNS, DHCP, AD)|Core Infra     |
|SQL01       |SQL Server                       |Core Infra     |
|WIN11-CLIENT|Windows 11 Pro workstation       |Core Infra     |
|SPSE-WFE01  |SharePoint SE — Web Front End    |SharePoint SE  |
|SPSE-APP01  |SharePoint SE — Application      |SharePoint SE  |
|SP2019-WFE01|SharePoint 2019 — Web Front End  |SharePoint 2019|
|SP2019-APP01|SharePoint 2019 — Application    |SharePoint 2019|
|SP2016-WFE01|SharePoint 2016 — Web Front End  |SharePoint 2016|
|SP2016-APP01|SharePoint 2016 — Application    |SharePoint 2016|

All machines: Windows Server, domain-joined, WinRM enabled (5985/5986), Negotiate auth.

-----

## SharePoint PowerShell Note

All SharePoint PS cmdlets require this prefix in every script that uses them:

```powershell
Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue
```

-----

## What NOT To Do (Common Mistakes to Avoid)

- ❌ Do NOT add `Microsoft.AspNetCore.SignalR` as a NuGet package (it’s in the SDK)
- ❌ Do NOT use packages version 9.x or 10.x with net8.0 target
- ❌ Do NOT use `Toggle-NetFirewallRule` — it doesn’t exist. Use `Set-NetFirewallRule -Enabled True/False`
- ❌ Do NOT commit `*.log`, `fix_*.sh`, `build_output.log`, `changes.txt` files
- ❌ Do NOT add `@clerk/react` or any Clerk dependency
- ❌ Do NOT use `any` in TypeScript
- ❌ Do NOT return hardcoded/mocked data from controllers
- ❌ Do NOT create a login form — NEXUS uses Windows Negotiate auth
- ❌ Do NOT duplicate `auth-store.ts` and `authStore.ts` — only `authStore.ts` is correct
- ❌ Do NOT read from old V1 phase files in repo root — use `PlanV2/` only

-----

## Definition of Done (Per Task)

A task is ONLY complete when:

1. `dotnet build src/Nexus.Gateway/Nexus.Gateway.csproj` → 0 errors
1. `cd src/Nexus.Frontend && npm run build` → 0 errors
1. No hardcoded mock data in any controller
1. No `any` types in TypeScript
1. `COMPLETION_NOTES.md` written in repo root summarising exactly what was done and what was NOT done

-----

## Source of Truth

Always read `PlanV2/MASTER_PLAN_V2.md` first. Every feature decision must align with it.
When in doubt — check the plan before implementing.