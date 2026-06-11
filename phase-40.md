# Phase 40 — Plugin Manager & Theme Manager UI

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the UI for managing the NEXUS ecosystem itself: the `plugin-manager` and `theme-manager` plugins. These meta-plugins allow administrators to enable/disable features, install third-party plugins, and customize the visual appearance of the application.

---

## Context: What is NEXUS?
NEXUS is designed as an extensible platform. While Phases 0-39 built the built-in plugins, administrators need a way to manage them. The Plugin Manager UI interacts with the backend Plugin Loader System (Phase 6). The Theme Manager allows overriding the default CSS variables established in Phase 11.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- **Plugin Manager (`plugins/plugin-manager/plugin.json`)**:
  - List all installed plugins (ID, Version, Author, Status).
  - Operations: Enable, Disable, Reload Manifests.
  - Permissions view: Show what scripts/commands a plugin is requesting.
  - Future hook: "Install from ZIP".
- **Theme Manager (`plugins/theme-manager/plugin.json`)**:
  - Provide a UI to adjust the core CSS variables (`--nexus-primary`, `--nexus-bg`, etc.).
  - Toggle between Dark and Light mode globally.
  - Save custom themes to the database (or localStorage).

**Out of scope:**
- An online "Plugin Store" or repository (Plugins are installed manually by dropping folders into the `/plugins` directory).

---

## Prerequisites
- Phase 6 (Plugin Loader System)
- Phase 11 (Theme Engine)
- Phase 12 (Plugin Renderer)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Meta | React 18 + TypeScript |
| API | ASP.NET Core Minimal APIs (`/api/system/plugins`) |

---

## Detailed Tasks

### 1. Create Plugin Manifests

```json
// plugins/plugin-manager/plugin.json
{
  "id": "plugin-manager",
  "name": "Plugin Manager",
  "description": "Manage installed NEXUS plugins.",
  "version": "1.0.0",
  "author": "NEXUS Core",
  "category": "Settings",
  "icon": "blocks",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "plugins",
        "title": "Plugins",
        "icon": "blocks",
        "component": "ui/Tool",
        "sidebar_group": "Settings",
        "sidebar_order": 90
      }
    ]
  },
  "permissions": {}
}
```

```json
// plugins/theme-manager/plugin.json
{
  "id": "theme-manager",
  "name": "Theme Settings",
  "description": "Customize NEXUS appearance.",
  "version": "1.0.0",
  "author": "NEXUS Core",
  "category": "Settings",
  "icon": "palette",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "themes",
        "title": "Appearance",
        "icon": "palette",
        "component": "ui/Tool",
        "sidebar_group": "Settings",
        "sidebar_order": 91
      }
    ]
  },
  "permissions": {}
}
```

### 2. Create Sidebar Tool Components

**Plugin Manager UI:**
- Data Grid displaying all plugins.
- Toggle switch for Enable/Disable (sends API call to backend to update configuration).
- Warning modal if disabling a P1 Core plugin.

**Theme Manager UI:**
- Color pickers for Primary, Secondary, Background, and Surface colors.
- "Live Preview" box showing a sample button and card.
- "Save as Custom Theme" button.

### 3. Backend API Integration
- Ensure `Program.cs` or the `PluginLoader` exposes endpoints like `POST /api/system/plugins/{id}/toggle`.

---

## Files to Create/Modify
- `plugins/plugin-manager/plugin.json`
- `plugins/plugin-manager/ui/Tool.tsx`
- `plugins/theme-manager/plugin.json`
- `plugins/theme-manager/ui/Tool.tsx`

---

## Test Criteria
- [ ] Disabling a non-core plugin immediately removes its tools and panels from the UI upon refresh.
- [ ] Changing a theme color variable immediately updates the application's CSS in the browser.

---

## Sub-Phase Breakdown (if needed)
- **40-0:** Plugin manifest + README + folder structure
- **40-1:** Scripts implementation
- **40-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.


