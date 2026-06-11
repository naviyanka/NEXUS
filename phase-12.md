# Phase 12 — Plugin Renderer System (React)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the frontend Plugin Renderer — the engine that reads loaded plugin manifests and dynamically renders their contributions into the correct UI slots (sidebar tools, toolbar widgets, dashboard panels, context menus). This is what makes "drop a folder → feature appears in UI" work on the frontend.  
  
---  
  
## Context  
Plugins contribute UI components (Panel.tsx, Tool.tsx, Widget.tsx) plus metadata about where to render them. The PluginRenderer reads this metadata from the backend `/api/plugins` and dynamically renders the right component in the right slot. Since plugins are external JSX files, they are loaded via dynamic imports (`import()`).  
  
---  
  
## Scope  
**In scope:**  
- `PluginRenderer.tsx` — core renderer component that takes a plugin ID + slot and renders it  
- Dynamic plugin component loading (`React.lazy` + `import()`)  
- Sidebar auto-population from plugin `tools` contributions  
- Topbar widget rendering from plugin `widgets` contributions  
- Plugin context menus on machine cards  
- Plugin command palette entries (Ctrl+K integration later)  
- Error boundary per plugin (one broken plugin doesn't crash the shell)  
  
**Out of scope:**  
- Dashboard grid panel rendering (Phase 13)  
- Plugin manager UI (Phase 40)  
  
---  
  
## Prerequisites  
- Phase 10 (frontend shell)  
- Phase 6 (backend plugin loader)  
  
---  
  
## PluginRenderer Architecture  
  
```tsx  
// src/Nexus.Frontend/src/shell/PluginRenderer.tsx  
  
// The renderer supports rendering a plugin's component into any slot:  
// Slot types: 'panel' | 'tool' | 'widget' | 'settings'  
  
interface PluginRendererProps {  
  pluginId: string;  
  slot: 'panel' | 'tool' | 'widget' | 'settings';  
  contributionId?: string;  
  machineContext?: MachineStatus;  // For context menu items  
}  
  
// Plugin components are loaded as: /plugins/{pluginId}/ui/{Component}.tsx  
// They're served by the backend as static files from the plugins/ directory  
// Dynamic import: const Component = React.lazy(() => import(`/plugins/${id}/ui/Tool`))  
```  
  
## Plugin Contribution Resolution  
  
When the frontend starts:  
1. Fetch `GET /api/plugins` → get all plugin manifests  
2. For each plugin with `contributes.tools`, add a sidebar item  
3. For each plugin with `contributes.widgets`, add to topbar  
4. Store all in `pluginStore`  
  
```tsx  
// src/Nexus.Frontend/src/store/pluginStore.ts  
// Derive from loaded plugins:  
interface PluginStore {  
  plugins: PluginManifest[];  
  sidebarItems: SidebarItem[];   // Derived from tools contributions  
  toolbarWidgets: Widget[];      // Derived from widgets contributions  
  dashboardPanels: Panel[];      // Derived from panels contributions  
}  
```  
  
## Sidebar Auto-Population  
  
```tsx  
// src/Nexus.Frontend/src/shell/Sidebar.tsx  
// Reads pluginStore.sidebarItems and renders them grouped by sidebar_group  
// Groups: "System", "SharePoint", "Network", "Scripts", "Settings"  
// Each item: icon + label → links to /plugins/{pluginId}/{toolId}  
// Active state: highlight current route  
  
// Example sidebar structure derived from plugins:  
// ─── System  
//   🖥 Machines         (machine-overview plugin)  
//   💻 Remote Terminal  (remote-terminal plugin)  
//   ⚙ Services         (service-manager plugin)  
//   📋 Event Viewer     (event-viewer plugin)  
// ─── SharePoint  
//   🏢 Farm Health      (sp-farm-health plugin)  
//   🔧 IIS Manager      (sp-iis-manager plugin)  
```  
  
## Error Boundary Per Plugin  
  
```tsx  
// src/Nexus.Frontend/src/shell/PluginErrorBoundary.tsx  
// Wraps every plugin render in an error boundary  
// Shows: "Plugin [name] failed to load" card with error details  
// Rest of the UI continues working  
class PluginErrorBoundary extends React.Component {  
  state = { hasError: false, error: null };  
  static getDerivedStateFromError(error) { return { hasError: true, error }; }  
  render() {  
    if (this.state.hasError) return <PluginErrorCard pluginId={this.props.pluginId} error={this.state.error} />;  
    return this.props.children;  
  }  
}  
```  
  
## Plugin Context for Tool Components  
  
Every plugin tool/panel receives a standard context object:  
  
```typescript  
interface NexusPluginContext {  
  machines: MachineStatus[];  
  groups: MachineGroup[];  
  selectedMachine?: MachineStatus;  
  api: AxiosInstance;              // Pre-authenticated Axios instance  
  signalr: SignalRManager;         // Connected SignalR client  
  theme: ThemeDefinition;          // Active theme tokens  
  user: NexusUser;                 // Logged-in user  
  runCommand: (commandId: string, targets: string[]) => Promise<ScriptResult>;  
}  
```  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Frontend/src/shell/PluginRenderer.tsx` | Create |  
| `src/Nexus.Frontend/src/shell/PluginErrorBoundary.tsx` | Create |  
| `src/Nexus.Frontend/src/shell/Sidebar.tsx` | Modify (auto-populate from plugins) |  
| `src/Nexus.Frontend/src/shell/Topbar.tsx` | Modify (render toolbar widgets) |  
| `src/Nexus.Frontend/src/store/pluginStore.ts` | Modify (derive sidebar/toolbar items) |  
| `src/Nexus.Frontend/src/hooks/usePlugin.ts` | Create (plugin context hook) |  
| `src/Nexus.Gateway/` | Add static file serving for `plugins/*/ui/` files |  
  
---  
  
## Test Criteria  
- [ ] Sidebar shows tool items for all loaded plugins that contribute `tools`  
- [ ] Navigating to `/plugins/service-manager` renders that plugin's `Tool.tsx` component  
- [ ] If a plugin's `Tool.tsx` throws, error boundary shows card without crashing shell  
- [ ] Toolbar shows widgets for plugins that contribute `widgets` (right-aligned)  
- [ ] Hot-reloading a plugin (via Phase 6 backend) causes sidebar to update on next fetch  
- [ ] `usePlugin()` hook provides correct plugin context to plugin components  
- [ ] Plugin with no `tools` contribution adds nothing to sidebar  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **12-0:** Dynamic import loader + PluginRenderer base  
- **12-1:** PluginErrorBoundary  
- **12-2:** Sidebar auto-population from plugin manifests  
- **12-3:** Toolbar widget rendering  
- **12-4:** Plugin context object + `usePlugin` hook  
  
---  
  
## Notes for Coding Agent  
- Plugin UI files (`.tsx`) are served as static assets from the backend — NOT bundled into the main app  
- Use `React.lazy(() => import('/plugins/...' + ...))` for dynamic loading  
- The `Suspense` fallback should be a skeleton/spinner component, not null  
- Backend needs to serve `plugins/*/ui/` as static files (whitelist — only `.js/.jsx/.tsx` files)  
- Plugin components MUST be default exports  
- Plugin context is provided via React Context, not props drilling  