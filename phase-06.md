# Phase 6 — Plugin Loader System (Manifest + Lifecycle)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the plugin discovery and loading system based on the **Static Compilation Model**. At startup, NEXUS scans the `plugins/` directory, reads every `plugin-manifest.json`, validates it, checks permissions, and registers all contributions (panels, tools, widgets).
  
---  
  
## Plugin Architecture — Static Compilation Model (V1 Mandatory)

NEXUS V1 uses a **Static Plugin Model**. All plugins are compiled into the
frontend bundle at build time. The manifest system controls visibility,
enablement, and permission gating — NOT code injection.

### What "Plugin" means in V1

| Concept | Implementation |
|---|---|
| Plugin Code | React component, compiled into main bundle |
| Plugin Registration | Entry in `plugin-manifest.json` |
| Plugin Enable/Disable | Manifest flag → Zustand store → conditional render |
| Plugin Permissions | Declared in manifest → checked at render time |
| Plugin Updates | Require full frontend rebuild + redeploy |

### Plugin Manifest Schema (`plugin-manifest.json`)

```typescript
interface PluginManifest {
  id: string;                    // e.g. "sp-farm-health"
  version: string;               // semver
  displayName: string;
  description: string;
  category: string;              // "SharePoint" | "Windows" | "SQL" | "Security" | "Reports"
  minNexusVersion: string;       // semver — compatibility gate
  requiredPermissions: string[]; // e.g. ["winrm.execute", "sp.admin"]
  entryComponent: string;        // Component name in compiled bundle
  enabled: boolean;
  icon?: string;                 // Lucide icon name
  routes?: PluginRoute[];
  apiEndpoints?: string[];       // Backend routes this plugin calls
}
```

### Plugin Lifecycle (Static Model)

```
Build Time:   Compile → Bundle → ManifestValidate
Load Time:    ReadManifest → PermissionCheck → ConditionalRegister
Runtime:      Enable/Disable toggle (state only, no code load/unload)
Update:       Rebuild → Redeploy → ManifestVersionBump
```

### 🚫 NOT SUPPORTED IN V1

- Module Federation (Webpack 5) — deferred to V2
- Dynamic `import()` of plugin code at runtime
- Remote plugin bundles loaded from URL
- Plugin sandboxing / iframe isolation

> **Note for V2 planning:** Module Federation with Vite requires `@originjs/vite-plugin-federation`.
> Evaluate for V2 only after V1 is stable and all 54 plugins are verified.

---

## Plugin Lifecycle — Complete State Machine

Every NEXUS plugin transitions through defined lifecycle states.
No plugin may execute if it has not passed `Validated` state.

### Lifecycle States

```
  [Registered] ──validate()──> [Validated] ──load()──> [Loaded]
       |                            |                      |
   (manifest                  (version +             (component
    present)                  permission              mounted)
                               checks)                   |
  [Uninstalled] <──unload()── [Disabled] <──disable()───[Active]
                                                          |
                                                     execute()
                                                          |
                                                     [Executing]
                                                          |
                                                   (job system
                                                    if async)
```

### Lifecycle Hook Definitions

```typescript
interface PluginLifecycleHooks {
  // Called once at app startup — validate manifest schema + version compat
  onValidate: (manifest: PluginManifest, nexusVersion: string) => ValidationResult;

  // Called when plugin is enabled — set up Zustand slices, register routes
  onLoad: (context: PluginContext) => void;

  // Called when user triggers plugin action
  onExecute: (params: Record<string, unknown>) => Promise<ExecutionResult>;

  // Called when plugin is disabled — clean up state, deregister routes
  onUnload: () => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface PluginContext {
  machineId: string;
  store: ZustandStore;
  apiClient: NexusApiClient;
  signalR: HubConnection;
  permissions: string[];
}
```

### Version Compatibility Enforcement

```typescript
function validatePluginCompat(manifest: PluginManifest, nexusVersion: string): boolean {
  return semver.gte(nexusVersion, manifest.minNexusVersion);
}
```

### Permission Declaration Enforcement

```typescript
// At plugin load time — check declared permissions against user role
function enforcePermissions(manifest: PluginManifest, userPerms: string[]): void {
  const missing = manifest.requiredPermissions.filter(p => !userPerms.includes(p));
  if (missing.length > 0) {
    throw new PluginPermissionError(manifest.id, missing);
  }
}
```

---  
  
## API Endpoints  
  
| Method | Endpoint | Description |  
|--------|----------|-------------|  
| GET | `/api/plugins` | List all loaded plugins |  
| GET | `/api/plugins/{id}` | Single plugin manifest |  
| PUT | `/api/plugins/{id}/toggle` | Enable/disable plugin |  
| GET | `/api/plugins/manifest-schema` | JSON Schema for plugin-manifest.json |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Models/PluginManifest.cs` | Create |  
| `src/Nexus.Gateway/Core/PluginLoader.cs` | Create |  
| `src/Nexus.Gateway/Controllers/PluginsController.cs` | Create |  
  
---  
  
## Test Criteria  
- [ ] All plugins in `plugins/` directory are loaded on startup  
- [ ] `GET /api/plugins` returns all loaded plugin manifests as JSON  
- [ ] Invalid `plugin.json` (missing required field) is reported in logs, other plugins unaffected  
- [ ] Permission missing from user role triggers `PluginPermissionError` preventing load
- [ ] Duplicate plugin ID logs an error and the second plugin is skipped  
- [ ] `PUT /api/plugins/sp-farm-health/toggle` disables the plugin (persisted across restart)  
- [ ] `GET /api/plugins?category=SharePoint` filters correctly  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **6-0:** PluginManifest C# model (full schema mapping)  
- **6-1:** PluginLoader startup scan + JSON deserialization  
- **6-2:** Schema validation + lifecycle enforcement 
- **6-3:** PluginsController + enable/disable persistence  
  
---  
  
## Notes for Coding Agent  
- Plugin manifests are read-only — the loader never writes to `plugin.json`  
- Plugin IDs must be unique — use kebab-case (e.g., `sp-farm-health`)  
- The `_template` folder must be skipped during loading  
- Minimum nexus version check: parse semantic version and compare