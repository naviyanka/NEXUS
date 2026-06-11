# Update NEXUS-MASTER-OVERVIEW.md - append integrations section  
  
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
  
#Auth: Add note that it's simplified  
  
---  
  
## ⚡ Integration Update (Replaces Custom Build)  
  
**Do NOT build custom Kerberos/NTLM middleware.** Use the official Microsoft NuGet:  
  
```bash  
dotnet add package Microsoft.AspNetCore.Authentication.Negotiate  
```  
  
```csharp  
// Program.cs — this IS the entire Kerberos/NTLM implementation  
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)  
    .AddNegotiate();  
builder.Services.AddAuthorization();  
```  
  
This is exactly how Windows Admin Center handles domain auth. One package, one line. The Negotiate handler automatically tries Kerberos first, falls back to NTLM. No custom code needed for the handshake.  
  
**Remaining work in this phase:**  
- JWT issuance after Negotiate validation (still needed for SignalR WS auth)  
- Authorization policies (ReadOnly / Operator / Admin)  
- Local auth fallback using `npx shadcn add login-01` for the UI page  
  
**Estimated effort revised: 0.5 days** (was 1 day)  
  
  
# Script Library: Add TRMM community scripts integration  
  
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
  
  
# React setup: Replace from-scratch with shadcn-admin fork  
  
---  
  
## ⚡ MAJOR Integration Update — Fork satnaing/shadcn-admin  
  
**Do NOT bootstrap from scratch with `npm create vite`.** Fork satnaing/shadcn-admin instead.  
  
```bash  
# Step 1: Clone into frontend folder  
git clone https://github.com/satnaing/shadcn-admin.git src/NEXUS.Frontend  
cd src/NEXUS.Frontend  
  
# Step 2: Install deps (already configured — Vite + React + TS + shadcn + Tailwind)  
pnpm install   # or npm install  
```  
  
**What you GET for free (no need to build):**  
- ✅ Vite + React 18 + TypeScript 5 + Tailwind CSS already configured  
- ✅ shadcn/ui components already installed (Button, Card, Badge, Table, Modal, etc.)  
- ✅ React Router v6 routing already set up  
- ✅ Dark/Light mode theming already working  
- ✅ Sidebar with collapsible groups (Phase 26 done)  
- ✅ Topbar with user menu and search  
- ✅ Command palette (Ctrl+K) already implemented (Phase 32 done)  
- ✅ Sign-in page already exists  
- ✅ Responsive layout already working  
- ✅ Lucide React icons already installed  
- ✅ ESLint + Prettier already configured  
  
**What to STRIP after cloning:**  
```  
DELETE: src/features/apps/ (mail, tasks, chat demo pages)  
DELETE: src/features/users/ (fake user management demo)    
DELETE: src/data/ (all mock/fake data files)  
DELETE: src/hooks/use-fake-search.ts  
KEEP EVERYTHING ELSE  
```  
  
**What to ADD on top:**  
- NEXUS plugin renderer (PluginHost, PanelHost, WidgetHost)  
- Zustand machine/plugin/notification stores  
- Axios API client + SignalR client  
- NEXUS CSS token overrides in globals.css  
- react-grid-layout for dashboard  
- xterm.js for terminal  
  
**Auth page:** Already exists in shadcn-admin. Enhance with:  
```bash  
npx shadcn add login-01   # replace existing sign-in with this variant if preferred  
```  
  
**Estimated effort revised: 0.5 days** (was 1 day) — most boilerplate is done  
  
  
# State: Note what shadcn-admin already provides  
  
---  
  
## ⚡ Integration Update — shadcn-admin Already Provides  
  
After forking satnaing/shadcn-admin (Phase 23), the following are **already present**:  
  
**Already done — do NOT rebuild:**  
- ✅ Auth store skeleton (check `src/stores/authStore.ts` or equivalent)  
- ✅ Theme store (dark/light toggle working)  
- ✅ Axios instance may already be configured — check `src/lib/` folder first  
  
**NEXUS-specific stores to ADD** (these don't exist in shadcn-admin):  
- `src/store/machineStore.ts` — all 9 lab machines + live status  
- `src/store/pluginStore.ts` — plugin contributions from API  
- `src/store/notificationStore.ts` — alerts + SignalR events  
  
**Check before writing:**  
```bash  
# Always check what shadcn-admin already has before creating new files  
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "store\|axios\|api" 2>/dev/null  
```  
  
**Estimated effort revised: 0.5 days** (was 1 day)  
  
  
# Theme Engine: Extend shadcn-admin's existing theme  
  
---  
  
## ⚡ Integration Update — Extend shadcn-admin Theming  
  
satnaing/shadcn-admin already has:  
- ✅ Dark/Light mode toggle working via ThemeProvider  
- ✅ shadcn/ui CSS variables (`--background`, `--foreground`, `--primary` etc.)  
- ✅ Tailwind v4 CSS variable integration  
  
**Do NOT replace the existing theme system.** Extend it:  
  
```css  
/* Add NEXUS-specific tokens ON TOP of shadcn-admin's existing globals.css */  
:root {  
  /* NEXUS additions — shadcn vars stay unchanged */  
  --color-status-online:  oklch(0.75 0.18 142);  
  --color-status-offline: oklch(0.55 0.22 27);  
  --color-status-warning: oklch(0.80 0.18 85);  
  --sidebar-width: 240px;  
  --topbar-height: 52px;  
}  
```  
  
**For cyberpunk/midnight-blue themes:** Override shadcn's existing `:root` vars in separate CSS files — same approach as shadcn dark mode but with custom palettes.  
  
**`npx shadcn add` still works** for adding new components — the theme stays intact.  
  
**Estimated effort revised: 0.5 days** (was 1 day)  
  
  
# Shell: Most of it is already in shadcn-admin  
  
---  
  
## ⚡ Integration Update — shadcn-admin Shell Already Built  
  
After forking satnaing/shadcn-admin, the shell is **90% done**:  
  
**Already exists — do NOT rebuild:**  
- ✅ AppShell component with CSS Grid layout  
- ✅ Sidebar with collapsible groups + icons-only collapsed mode  
- ✅ Topbar with user menu dropdown + search trigger  
- ✅ React Router v6 routing  
- ✅ Sign-in / sign-out flow  
- ✅ All shared UI components (Button, Card, Badge, Table, Modal, Input, etc.)  
- ✅ ConfirmDialog equivalent  
- ✅ Responsive layout  
  
**NEXUS additions on top (the only work needed):**  
1. Wire sidebar nav items from `pluginStore.tools` (replaces hardcoded nav)  
2. Add WidgetHost slots in Topbar (left/right plugin widget areas)  
3. Add NEXUS notification bell in Topbar (replace/extend existing user menu area)  
4. Add StatusBar component at bottom (SignalR status, version)  
5. Add `/tools/:toolId` route → ToolHost  
  
**For Login Page UI:**  
```bash  
# shadcn-admin already has sign-in page. To use official block instead:  
npx shadcn add login-01  
# Pick whichever variant you prefer from ui.shadcn.com/blocks/login  
```  
  
**Estimated effort revised: 0.5 days** (was 1.5 days)  
  
  
# Also update the remote-desktop plugin section in NEXUS-PLUGIN-REGISTRY.md  
  
---  
  
## 🔗 Plugin Integration Notes  
  
### remote-desktop plugin — Use guacamole-lite (NOT custom RDP code)  
  
```  
Architecture:  
guacd daemon (on NEXUS server, handles RDP/VNC protocol)  
    ↕ Guacamole protocol over TCP  
guacamole-lite (npm package — thin WS proxy, runs inside NEXUS.Frontend Node process or separate)    
    ↕ WebSocket  
guacamole-common-js (npm — renders RDP canvas in React browser)  
```  
  
```bash  
# Frontend  
npm install @guacamole/common-js  
  
# NEXUS server setup (run once on DC/NEXUS server)  
# Install guacd via chocolatey or manual:  
choco install apache-guacamole  
# Or use Docker: docker run -d -p 4822:4822 guacamole/guacd  
```  
  
Backend: Add `GuacamoleService.cs` that generates connection tokens for guacamole-lite.  
Do NOT implement RDP protocol from scratch.  
  
### script-library plugin — Use TRMM Community Scripts as seed  
  
```bash  
git clone https://github.com/amidaware/community-scripts.git /tmp/trmm-scripts  
# Filter Windows scripts:  
cat /tmp/trmm-scripts/community_scripts.json | python3 -c "  
import json,sys  
scripts=json.load(sys.stdin)  
win=[s for s in scripts if 'windows' in s.get('supported_platforms',['windows'])]  
print(f'{len(win)} Windows scripts available')  
"  
```  
  
  
## 🔖 NEXUS Context  
**NEXUS** — self-hosted agentless Windows server management platform. ASP.NET Core 8 Windows Service | React 18 + TypeScript + Tailwind v4 | SQLite/EF Core 8 | SignalR | WinRM + PS SDK | CIM/WMI | Kerberos/NTLM (AddNegotiate) | Quartz.NET | YamlDotNet | Inno Setup.  
**Frontend base:** Fork of satnaing/shadcn-admin (MIT). shadcn/ui components. guacamole-lite for RDP. TRMM community scripts as seed library.  
**Rules:** No hardcoded machine names | Features=plugins | Writes=AuditLog | Registry edits=backup first | Scripts via IScriptExecutor | WinRM via IWinRmConnectionPool | Frontend via apiClient.ts | CSS vars for themes | CancellationToken everywhere | PluginContext prop in plugin UI  
# WAC Parity Plugin Stubs (All 26)  
> **Group:** I — Plugin Stubs | **Effort:** 2 days  
>   
## 🎯 Goal  
Create all 26 WAC-equivalent plugin folder structures. Each gets: plugin.json manifest, empty script stubs, placeholder UI component. These are shells — actual implementation is handled per-plugin in dedicated plan files generated from NEXUS-PLUGIN-REGISTRY.md.  
## 📦 Pre-conditions  
 * NEXUS-PLUGIN-REGISTRY.md available — each plugin's features listed there  
## 📋 Tasks  
### Task 01: Create Plugin Folder Structure Script  
 * Create scripts/scaffold-plugin.ps1 — generates a plugin folder from a template:  
   ```powershell  
   param($pluginId, $pluginName, $category, $hasPanel, $hasTool, $hasWidget)  
     
   ```  
 * Creates: plugins/$pluginId/plugin.json, scripts/action.ps1, ui/Panel.tsx (if hasPanel)  
 * Run once per plugin to generate all 26 structures  
### Task 02: Generate All 26 WAC Parity Plugins  
 * Run scaffold-plugin.ps1 for each of the 26 plugins from NEXUS-PLUGIN-REGISTRY.md:  
   * machine-overview, remote-terminal, remote-desktop, service-manager, event-viewer  
   * process-manager, file-browser, windows-update, performance-monitor, scheduled-tasks  
   * certificate-manager, firewall-manager, registry-editor, local-users-groups, installed-apps  
   * network-adapters, storage-manager, roles-features, defender-integration, devices-manager  
   * dhcp-manager, dns-manager, active-directory, security-settings, windows-laps, local-security-policy  
### Task 03: remote-desktop plugin — Guacamole Integration  
 * This plugin is special — uses guacamole-lite instead of custom RDP code  
 * plugin.json: type=tool, contributes tool + context_menu command  
 * ui/RemoteDesktop.tsx: imports guacamole-common-js, renders Guacamole canvas  
 * Backend: GuacamoleService.cs generates connection token for target machine  
 * guacd must be installed on NEXUS server (Chocolatey: choco install apache-guacamole or Docker)  
 * Connection params: hostname from machine config, port 3389, domain credentials from ICredentialService  
### Task 04: Placeholder UI Components  
 * Each tool plugin gets a placeholder ui/Panel.tsx or ui/Tool.tsx:  
   * Shows: plugin name, description, 'Implementation pending' message, list of planned features  
   * This allows the sidebar nav to show all tools immediately — clicking shows what's coming  
   * Makes the app feel complete even before each plugin is fully implemented  
### Task 05: registry-editor plugin — Special Setup  
 * plugin.json must reference Phase 22 Registry Backup System backend  
 * Scripts use PS: Get-ItemProperty, Set-ItemProperty, reg.exe export/import  
 * ui/RegistryEditor.tsx: tree view + values panel (complex — mark as Phase 2 implementation)  
 * **IMPORTANT:** plugin.json permissions must include: requires_admin: true  
## 📁 Files  
 * plugins/machine-overview/plugin.json + scripts/ + ui/  
 * plugins/remote-terminal/plugin.json + scripts/ + ui/  
 * plugins/remote-desktop/plugin.json + scripts/ + ui/ (guacamole)  
 * plugins/service-manager/plugin.json + scripts/ + ui/  
 * ... (all 26 plugin folders)  
 * scripts/scaffold-plugin.ps1  
 * src/NEXUS.Gateway/Services/GuacamoleService.cs (stub)  
## 🚫 Do NOT Modify  
 * Phase 15 PluginManifestLoader — just add folders, hot-reload handles the rest  
 * Phase 27 PluginRenderer — do not modify, just add new plugin folders  
## ✅ Deliverables  
 * All 26 plugin folders exist in plugins/ directory  
 * Each has valid plugin.json (passes manifest validation)  
 * NEXUS hot-reloads and shows all 26 in Plugin Manager  
 * Sidebar shows all tool nav items  
 * remote-desktop plugin renders guacamole canvas placeholder  
 * registry-editor shows requires_admin badge  
## 🧪 Verification  
 * Start NEXUS — check GET /api/plugins shows all 26 plugins  
 * Open /settings/plugins — all 26 listed  
 * Click sidebar nav items — all route to /tools/{id} with placeholder UI  
 * Check remote-desktop: guacamole-common-js loads in browser (may show connection error until guacd configured — that's OK)  
## 💡 Agent Notes  
 * Do not implement full plugin logic here — these are stubs only. Full per-plugin implementation is generated from NEXUS-PLUGIN-REGISTRY.md on demand  
 * guacd installation is a one-time server setup — document in README  
 * The scaffold-plugin.ps1 script saves significant repetitive work — create it first before making all 26 folders manually  
# NEXUS Exclusive Plugin Stubs (All 16)  
> **Group:** I — Plugin Stubs | **Effort:** 1.5 days   
>   
## 🎯 Goal  
Create all 16 NEXUS-exclusive plugin folder structures. Same pattern as Phase 35 — shells with plugin.json, script stubs, and placeholder UI. These are the features WAC doesn't have.  
## 📦 Pre-conditions  
  
## 📋 Tasks  
### Task 01: Generate All 16 NEXUS Exclusive Plugins  
 * Use scaffold-plugin.ps1 for each exclusive plugin:  
   * script-runner, script-library, machine-groups, bulk-operations  
   * alert-manager, audit-log, lab-topology, lab-snapshot  
   * comparison-view, session-manager, bulk-patch-manager, command-palette  
   * cross-machine-search, performance-baseline, nexus-settings, plugin-manager (meta)  
### Task 02: script-runner plugin — TRMM Scripts Integration  
 * This plugin uses TRMM community scripts as its built-in library seed  
 * Clone github.com/amidaware/community-scripts locally during development  
 * Copy selected Windows .ps1 scripts to plugins/script-library/scripts/builtin/  
 * Reference them in the plugin's DatabaseSeeder integration (Phase 17)  
 * Scripts to include: disk cleanup, Windows Update check, service status, event log query, temp file cleanup, top processes, disk usage report  
### Task 03: lab-topology plugin — React Flow  
 * Install react-flow (or @xyflow/react) for the visual network diagram: npm install @xyflow/react  
 * Nodes auto-generated from machineStore.machines + machineStore.groups  
 * Edges: DC→SQL (data), WFE→APP (farm), all→DC (domain auth)  
 * Node click → navigate to /machines/{hostname}  
 * Layout: dagre auto-layout algorithm (@dagrejs/dagre)  
### Task 04: bulk-operations plugin — Parallel Execution  
 * plugin.json: contributes panel + tool + toolbar widget  
 * Machine multi-select uses shadcn/ui Checkbox component  
 * Progress display: one Card per machine with status badge (Pending/Running/Done/Failed)  
 * Connects to SignalR executionId stream for live progress per machine  
### Task 05: command-palette plugin — Already in shadcn-admin  
 * satnaing/shadcn-admin already has Ctrl+K command palette implemented  
 * This plugin extends it — registers NEXUS-specific commands  
 * Do NOT rebuild the palette UI — wire NEXUS commands into the existing palette  
 * Add to plugin.json: contributes.commands list that auto-registers in palette  
## 📁 Files  
 * plugins/script-runner/plugin.json + scripts/ + ui/  
 * plugins/script-library/plugin.json + scripts/builtin/ (TRMM scripts)  
 * plugins/machine-groups/plugin.json + scripts/ + ui/  
 * plugins/lab-topology/plugin.json + ui/ (react-flow)  
 * plugins/bulk-operations/plugin.json + scripts/ + ui/  
 * ... (all 16 plugin folders)  
## 🚫 Do NOT Modify  
 * existing plugins — do not touch  
 * PluginRenderer — do not modify  
 * shadcn-admin command palette — do not replace, only extend  
## ✅ Deliverables  
 * All 16 NEXUS exclusive plugin folders exist  
 * Each has valid plugin.json  
 * Total plugin count in GET /api/plugins: 42 (26 WAC + 16 exclusive)  
 * lab-topology renders basic node graph with machines from machineStore  
 * command-palette shows NEXUS commands in existing Ctrl+K palette  
## 🧪 Verification  
 * GET /api/plugins — count 42 plugins  
 * Open lab-topology tool — see machine nodes (no edges yet, placeholders OK)  
 * Press Ctrl+K — NEXUS machine commands appear in palette  
 * Check script-library tool — shows seeded TRMM scripts  
## 💡 Agent Notes  
 * Install @xyflow/react for lab-topology — it's the modern React Flow package  
 * The command palette from shadcn-admin uses cmdk library internally — NEXUS commands must be registered in the same command registry  
 * script-library scripts should be tagged as 'built-in' and non-deletable in the UI  
# SharePoint Plugin Stubs (All 8)  
> **Group:** I — Plugin Stubs | **Effort:** 1.5 days   
>   
## 🎯 Goal  
Create all 8 SharePoint-specific plugin folder structures with SP PowerShell script stubs. These require Add-PSSnapin Microsoft.SharePoint.PowerShell on target servers.  
## 📦 Pre-conditions  
 * All SP farm machines accessible via WinRM  
 * SharePoint PS snapin available on SP servers  
## 📋 Tasks  
### Task 01: Generate All 8 SharePoint Plugins  
 * Use scaffold-plugin.ps1 for each SP plugin:  
   * sp-farm-health, sp-service-status, sp-iis-manager, sp-distributed-cache  
   * sp-uls-viewer, sp-upgrade-checker, sp-config-diff, sp-search-health  
### Task 02: SP PowerShell Snapin Pattern  
 * ALL SharePoint scripts must start with:  
   ```powershell  
   Add-PSSnapin Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue  
   if (-not (Get-PSSnapin -Name Microsoft.SharePoint.PowerShell -ErrorAction SilentlyContinue)) {  
     Write-Error 'SharePoint PS snapin not available on this server'  
     exit 1  
   }  
     
   ```  
 * This must be the first block in every SP script stub  
### Task 03: sp-farm-health — Core SP Plugin  
 * This is P1 — give it more detail than other stubs:  
   * scripts/get-farm-status.ps1: Get-SPFarm, Get-SPServer, Get-SPServiceInstance  
   * scripts/get-build-version.ps1: Get-SPProduct | Select DisplayName,Version  
   * scripts/check-upgrade-required.ps1: Get-SPFarm | Select NeedsUpgrade,BuildVersion  
   * ui/SPFarmHealth.tsx: three farm cards (SPSE/SP2019/SP2016), each with server status dots  
 * Data source: POST /api/scripts/run-command targeting each farm's APP server  
### Task 04: Machine Group Tagging for SP  
 * Ensure machines.yaml has correct tags for SP targeting:  
   * SPSE-WFE01/SPSE-APP01: tags: [sharepoint, spse, wfe/app]  
   * SP2019-WFE01/SP2019-APP01: tags: [sharepoint, sp2019, wfe/app]  
   * SP2016-WFE01/SP2016-APP01: tags: [sharepoint, sp2016, wfe/app]  
 * SP plugin menus use 'when' condition: machine.tags includes sharepoint  
### Task 05: sp-distributed-cache — Known Issue Detection  
 * scripts/check-dc-status.ps1 must check for the known SPSE bug:  
   * Use Use-CacheCluster; Get-AFCacheHostConfiguration  
   * Check if DC service is in 'Stopping' or unexpected state  
   * Check Windows registry for AppFabric service revert  
   * Focus explicitly on robust detection mapping for this legacy component behavior  
## 📁 Files  
 * plugins/sp-farm-health/plugin.json + scripts/ (4 scripts) + ui/SPFarmHealth.tsx  
 * plugins/sp-service-status/plugin.json + scripts/ + ui/  
 * plugins/sp-iis-manager/plugin.json + scripts/ + ui/  
 * plugins/sp-distributed-cache/plugin.json + scripts/ + ui/  
 * plugins/sp-uls-viewer/plugin.json + scripts/ + ui/  
 * plugins/sp-upgrade-checker/plugin.json + scripts/ + ui/  
 * plugins/sp-config-diff/plugin.json + scripts/  
 * plugins/sp-search-health/plugin.json + scripts/ + ui/  
## 🚫 Do NOT Modify  
 * plugin stubs — separate plugins, no cross-modification  
 * machines.yaml group structure already set in Phase 03  
## ✅ Deliverables  
 * All 8 SP plugin folders exist with valid plugin.json  
 * SP scripts have correct snapin guard at top  
 * sp-farm-health tool renders 3 farm cards (data: placeholder until backend wired)  
 * SP plugins only appear in context menus when machine.tags includes 'sharepoint'  
 * GET /api/plugins shows 50 total plugins (26+16+8)  
## 🧪 Verification  
 * GET /api/plugins — count should be 50  
 * Open sp-farm-health tool — 3 farm cards visible  
 * Right-click SPSE-WFE01 — SP-specific context menu items appear  
 * Right-click SQL01 — SP context menu items do NOT appear (when condition filtering)  
 * Run sp-farm-health script against SPSE-APP01 — returns farm info or clear error if SP not accessible  
## 💡 Agent Notes  
 * SharePoint PS snapin only works on SharePoint servers — never try to run SP scripts on DC or SQL  
 * WFE servers can run SP PS commands — APP servers are better for farm-level queries  
 * Ensure the sp-distributed-cache state engine surfaces infrastructure alerts proactively within the UI dashboard framework  
# Security & Hardening  
> **Group:** J — Polish | **Effort:** 1.5 days  
>   
## 🎯 Goal  
Apply security hardening across the entire NEXUS application: HTTPS enforcement, Content Security Policy, rate limiting, input sanitization, CORS policy, and RBAC enforcement audit.  
## 📦 Pre-conditions  
 * Core API with rate limiting stub  
 * Auth system working  
 * HTTPS on Kestrel  
## 📋 Tasks  
### Task 01: HTTPS Enforcement  
 * app.UseHttpsRedirection() already in pipeline  
 * Add HSTS: app.UseHsts() with max-age=31536000 (1 year) in production  
 * Ensure Kestrel only listens on HTTPS port (7443) in production — no plain HTTP listener  
 * Self-signed cert warning: document that users must add cert to trusted store or use browser exception  
### Task 02: Content Security Policy Headers  
 * Add security headers middleware:  
   * X-Content-Type-Options: nosniff  
   * X-Frame-Options: DENY  
   * X-XSS-Protection: 1; mode=block  
   * Referrer-Policy: strict-origin-when-cross-origin  
   * Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' (shadcn needs this); style-src 'self' 'unsafe-inline'; connect-src 'self' wss://localhost:7443  
 * Note: shadcn/ui and xterm.js require 'unsafe-inline' for styles — document this trade-off  
### Task 03: Input Sanitization Audit  
 * Review all API endpoints for unsanitized inputs:  
   * Script content: limit to 1MB, validate language matches extension  
   * Machine hostname: alphanumeric + hyphen + dot only (regex validation)  
   * Registry key paths: whitelist characters, block path traversal attempts  
   * YAML config writes: validate against schema before saving  
 * FluentValidation validators (Phase 20) must cover all request models  
### Task 04: RBAC Enforcement Audit  
 * Review all endpoints and confirm correct policy applied:  
   * GET endpoints: [Authorize(Policy='ReadOnly')]  
   * POST/PUT script execution: [Authorize(Policy='Operator')]  
   * DELETE/registry edit/credential: [Authorize(Policy='Admin')]  
   * Settings changes: [Authorize(Policy='Admin')]  
 * Add integration test: verify 403 returned for each policy when wrong role used  
### Task 05: Dependency Security Scan  
 * Run: dotnet list package --vulnerable  
 * Run: npm audit (in NEXUS.Frontend)  
 * Fix any high/critical vulnerabilities found  
 * Add to build script: fail build if high vulnerabilities detected  
## 📁 Files  
 * src/NEXUS.Gateway/Middleware/SecurityHeadersMiddleware.cs  
 * src/NEXUS.Gateway/Middleware/ErrorHandlingMiddleware.cs (review)  
 * src/NEXUS.Gateway/Program.cs (add HSTS, security middleware)  
 * src/NEXUS.Gateway/Validators/ (audit all validators)  
## 🚫 Do NOT Modify  
 * auth — do not change Negotiate/JWT config  
 * rate limiting — already in place, just verify settings  
 * Any plugin files — security hardening is gateway-level only  
## ✅ Deliverables  
 * HTTPS-only: plain HTTP requests redirect to HTTPS  
 * Security headers present on all responses (verify with curl -I)  
 * dotnet list package --vulnerable returns 0 high/critical  
 * npm audit returns 0 high/critical  
 * RBAC: 403 returned when wrong role tries protected endpoint  
 * CSP header set and allows shadcn/xterm.js to function  
## 🧪 Verification  
 * curl -k -I https://localhost:7443/health — check response headers for security headers  
 * Try accessing Admin endpoint with Operator JWT — verify 403  
 * dotnet list package --vulnerable — verify clean  
 * npm audit — verify clean  
 * Test CSP: open browser console on NEXUS, verify no CSP violations for normal operation  
## 💡 Agent Notes  
 * 'unsafe-inline' in CSP is a known trade-off with shadcn/ui + Tailwind — document this in security notes, it's acceptable for an internal tool  
 * HSTS should only be set in production (IsProduction check) — in development it causes issues with self-signed certs and browser caching  
# Installer (Inno Setup → NEXUS-Setup.exe)  
> **Group:** J — Polish | **Effort:** 2 days  
>   
## 🎯 Goal  
Build the production installer using Inno Setup 6. One .exe file that installs NEXUS on any domain-joined Windows Server — registers as Windows Service, opens firewall port, creates default config, and optionally installs .NET 8 runtime if missing.  
## 📦 Pre-conditions  
 * security hardening done  
 * npm run build produces dist/frontend/ successfully  
 * dotnet publish produces self-contained executable  
 * Inno Setup 6 installed on build machine  
## 📋 Tasks  
### Task 01: dotnet publish — Self-Contained Executable  
 * Create installer/publish.ps1:  
   ```powershell  
   dotnet publish src/NEXUS.Gateway -c Release -r win-x64 --self-contained true -o installer/publish/  
     
   ```  
 * Self-contained: includes .NET 8 runtime — no prerequisite on target server  
 * Single file: -p:PublishSingleFile=true (optional — reduces to one nexus.exe)  
 * Output: installer/publish/nexus.exe + config/ + plugins/ + themes/  
### Task 02: Frontend Build Integration  
 * installer/publish.ps1 also runs frontend build:  
   * cd src/NEXUS.Frontend && npm run build  
   * Frontend dist/ copied to installer/publish/frontend/  
   * Kestrel serves frontend from this path in production  
### Task 03: Inno Setup Script  
 * Create installer/nexus-setup.iss:  
   * [Setup] section: AppName=NEXUS, AppVersion from NEXUS.Core/Constants, DefaultDirName={pf}\NEXUS  
   * [Files] section: include all files from installer/publish/  
   * [Run] section after install:  
     1. sc.exe create NEXUSGateway binPath=... start=auto displayname='NEXUS Gateway'  
     2. netsh advfirewall add rule name='NEXUS' dir=in action=allow protocol=TCP localport=7443  
     3. net start NEXUSGateway  
     4. Open browser: https://localhost:7443  
   * [UninstallRun]: net stop NEXUSGateway, sc.exe delete NEXUSGateway, remove firewall rule  
   * [Code] section: check if .NET 8 runtime installed — if self-contained, skip this check  
### Task 04: Silent Install Support  
 * Support: NEXUS-Setup.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART  
 * Support: /PORT=8443 custom port parameter  
 * Support: /AUTHMODE=Local for non-domain installs  
 * These allow automated/scripted deployment  
### Task 05: Installer Welcome Screen  
 * Custom Inno Setup wizard pages:  
   * Page 1: NEXUS logo + 'Welcome to NEXUS Setup'  
   * Page 2: License (MIT)  
   * Page 3: Port selection (default 7443)  
   * Page 4: Auth mode (Windows Auth recommended / Local)  
   * Page 5: Installing... progress  
   * Page 6: Done — checkbox 'Open NEXUS in browser'  
### Task 06: Upgrade Support  
 * If NEXUSGateway service already exists:  
   * Stop service → backup config/ → install new files → restore config/ → start service  
 * Never overwrite: config/machines.yaml, config/credentials.yaml, data/nexus.db  
 * These are user data — always preserve on upgrade  
## 📁 Files  
 * installer/publish.ps1  
 * installer/nexus-setup.iss  
 * installer/nexus-setup-resources/ (logo, banner images for wizard)  
 * installer/build-installer.ps1 (runs publish.ps1 then Inno Setup compiler)  
## 🚫 Do NOT Modify  
 * All source code — installer only packages the build output  
 * Plugin files — never modify plugin code from installer scripts  
## ✅ Deliverables  
 * NEXUS-Setup.exe produced in installer/output/  
 * Silent install works: NEXUS-Setup.exe /VERYSILENT  
 * After install: NEXUSGateway service running (Get-Service NEXUSGateway)  
 * Firewall rule created: netsh advfirewall show rule name=NEXUS  
 * Browser opens https://localhost:7443 on install completion  
 * Upgrade preserves existing machines.yaml and nexus.db  
 * Uninstall cleans up service and firewall rule  
## 🧪 Verification  
 * Run NEXUS-Setup.exe on a clean Windows Server 2022 VM  
 * Verify: Get-Service NEXUSGateway — Status: Running  
 * Verify: netsh advfirewall show rule name=NEXUS — exists  
 * Open browser: https://localhost:7443 — NEXUS loads  
 * Run NEXUS-Setup.exe again on same machine (upgrade) — verify config preserved  
 * Run uninstaller — verify service and firewall rule removed  
## 💡 Agent Notes  
 * Inno Setup 6 is free and available at jrsoftware.org/isinfo.php — install on build machine only  
 * Self-contained publish increases exe size (~80MB) but eliminates dependency execution headaches — worth it  
 * The installer should NOT require internet access — all dependencies bundled in the exe  
# Testing & Documentation  
> **Group:** J — Polish | **Effort:** 2 days | **Depends On:** All phases  
>   
## 🎯 Goal  
Write unit tests, integration tests, and complete documentation. Plugin development guide, theme creation guide, and operations README.  
## 📦 Pre-conditions  
 * All previous phases complete  
 * Full NEXUS application running end-to-end  
 * All plugins loading and functional  
## 📋 Tasks  
### Task 01: xUnit Unit Tests — Backend  
 * Create tests covering core services:  
   * YamlConfigurationServiceTests: parse machines.yaml, invalid YAML, hot-reload  
   * PluginManifestLoaderTests: valid manifest, missing required fields, dependency resolution  
   * ScriptExecutorTests: PS1 execution output streaming, cancellation, error handling  
   * RegistryBackupServiceTests: backup created before edit, restore applies .reg file  
   * AuditServiceTests: entry persisted, query filter works, export format correct  
   * AlertEvaluatorTests: condition evaluation, cooldown suppression, notification dispatch  
 * Use in-memory SQLite for all DB tests (UseSqlite('Data Source=:memory:'))  
### Task 02: Integration Tests — API  
 * Create tests/NEXUS.Gateway.Tests/Integration/ tests:  
   * GET /health returns 200 + version  
   * GET /api/machines with mock IConfigurationService returns machine list  
   * POST /api/scripts/run requires auth (401 without JWT)  
   * POST /api/registry/{machine}/values requires Admin policy (403 for Operator)  
   * GET /api/plugins lists all plugins from test plugins/ folder  
 * Use WebApplicationFactory<Program> for integration test host  
### Task 03: README.md — Complete  
 * Update root README.md with:  
   * What NEXUS is (2 paragraphs)  
   * Quick start: download NEXUS-Setup.exe → run → open browser  
   * Prerequisites: domain-joined Windows Server, WinRM enabled on target machines  
   * Architecture diagram (copy from NEXUS-MASTER-OVERVIEW.md)  
   * Configuration: machines.yaml format with examples  
   * Third-party credits: satnaing/shadcn-admin, guacamole, TRMM community scripts, shadcn/ui  
### Task 04: Plugin Development Guide  
 * Create docs/plugin-development-guide.md:  
   * Step 1: Copy plugins/_template/ folder  
   * Step 2: Fill in plugin.json (all fields documented with examples)  
   * Step 3: Write your PS1/Python/Batch script  
   * Step 4: (Optional) Create React UI component  
   * Step 5: Drop folder in plugins/ — NEXUS hot-reloads  
   * Full plugin.json field reference  
   * PluginContext API reference for UI components  
   * Common patterns: polling a WMI class, streaming script output, showing confirmation  
### Task 05: Theme Creation Guide  
 * Create docs/theme-creation-guide.md:  
   * Step 1: Copy themes/_template/ folder  
   * Step 2: Edit theme.json — change color values (OKLCH format recommended)  
   * Step 3: Drop folder in themes/ — appears in Theme Manager immediately  
   * Full CSS token reference with descriptions  
   * OKLCH color format explanation + tool links (oklch.com)  
   * overrides.css examples for advanced customization  
## 📁 Files  
 * tests/NEXUS.Core.Tests/ (unit test files)  
 * tests/NEXUS.Gateway.Tests/Integration/ (integration test files)  
 * README.md (complete rewrite)  
 * docs/plugin-development-guide.md  
 * docs/theme-creation-guide.md  
 * docs/operations-guide.md (backup, logs, upgrade, troubleshooting)  
## 🚫 Do NOT Modify  
 * All source code — tests only import and call, never modify  
 * Plugin files — tests use a dedicated test-plugins/ folder, not the main plugins/ folder  
## ✅ Deliverables  
 * dotnet test — all tests pass, 0 failures  
 * Code coverage > 60% on core services  
 * README.md accurately describes installation and configuration  
 * Plugin guide: following it produces a working plugin in under 15 minutes  
 * Theme guide: following it produces a custom theme in under 5 minutes  
## 🧪 Verification  
 * dotnet test — verify pass  
 * npm test (if frontend tests configured) — verify pass  
 * Follow plugin guide from scratch: result should load in NEXUS without errors  
 * Follow theme guide from scratch: result should appear in Theme Manager  
 * Share README with a verification team to confirm clean installation flow without external troubleshooting steps  
## 💡 Agent Notes  
## 💡 Agent Notes  
 * Third-party credits are important — add satnaing/shadcn-admin, Apache Guacamole, TRMM community scripts, shadcn/ui to README and a CREDITS.md file  
 * The plugin guide is the most important doc — it's what allows future feature additions without touching core code  
 * Test the installer on a completely clean Windows Server VM (no dev tools) — this catches many environment-specific integration edge cases  
 * Only implement what is described. Refer to NEXUS-MASTER-OVERVIEW.md for full context.  
  
  
