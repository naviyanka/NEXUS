# Phase 13 — Dashboard Grid Engine (Drag-Drop + Persistence)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the main dashboard — a drag-and-drop grid where plugin panels live. Users can rearrange, resize, add, and remove panels. Layout is persisted per user in SQLite and restored on next login. Plugins contribute panels (with default sizes) that appear here.  
  
---  
  
## Context  
The NEXUS main dashboard (`/`) is a configurable grid of panels. Each panel is contributed by a plugin (e.g., machine-overview contributes a 12-wide machine grid, sp-farm-health contributes a 6-wide status panel). Users drag panels to rearrange them. The layout is saved automatically per user.  
  
---  
  
## Scope  
**In scope:**  
- `DashboardGrid.tsx` — @dnd-kit powered drag-drop grid  
- Grid system: 12-column, variable-height rows  
- Panel resizing via handles  
- Add/remove panel controls  
- Layout serialization (JSON) + persistence via `PUT /api/dashboard/layout`  
- Layout loading on page load via `GET /api/dashboard/layout`  
- Default layout (defined by plugins' default panel sizes)  
- "Reset to default" option  
  
**Out of scope:**  
- Actual panel content (each plugin phase provides the panel component)  
- For now panels show a placeholder with the plugin name  
  
---  
  
## Prerequisites  
- Phase 10 (frontend shell)  
- Phase 12 (plugin renderer)  
- Phase 5 (SQLite — for layout persistence)  
  
---  
  
## Grid Model  
  
```typescript  
// Layout JSON stored in SQLite  
interface DashboardLayout {  
  panels: PanelLayout[];  
}  
  
interface PanelLayout {  
  id: string;           // unique instance ID (uuid)  
  pluginId: string;     // which plugin provides the panel  
  panelId: string;      // which panel contribution from that plugin  
  x: number;            // column position (0-11)  
  y: number;            // row position  
  w: number;            // width in columns (1-12)  
  h: number;            // height in rows  
}  
```  
  
## DashboardGrid.tsx  
  
```tsx  
// src/Nexus.Frontend/src/shell/DashboardGrid.tsx  
// Uses @dnd-kit/core DndContext + @dnd-kit/sortable SortableContext  
// Each panel is a DraggablePanel component with resize handles  
// Layout changes trigger auto-save (debounced 1 second)  
// Panels render: <PluginRenderer pluginId={p.pluginId} slot="panel" contributionId={p.panelId} />  
```  
  
## Dashboard Toolbar (Add Panel)  
  
```tsx  
// Panel picker: shows available panels from all loaded plugins  
// "Add Panel" button → opens drawer/modal with panel list  
// Click → adds panel to grid at default position  
// Shows panel name, plugin name, default size  
```  
  
## Backend — Dashboard Layout API  
  
```csharp  
// GET  /api/dashboard/layout  → returns saved layout JSON for current user  
// PUT  /api/dashboard/layout  → saves layout JSON for current user  
// POST /api/dashboard/layout/reset → resets to default layout  
// GET  /api/dashboard/default-layout → built-in default from plugin manifests  
```  
  
## Default Layout Construction  
  
```csharp  
// Reads all loaded plugins, gathers panels with their default sizes  
// Constructs a sensible default layout:  
// Row 1: machine-overview (full width, w:12)  
// Row 2: sp-farm-health (w:8) + alert-manager widget (w:4)  
// Row 3: script-runner (w:6) + performance-graphs (w:6)  
// Row 4: event-viewer (w:12)  
```  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Frontend/src/shell/DashboardGrid.tsx` | Create |  
| `src/Nexus.Frontend/src/shell/DraggablePanel.tsx` | Create |  
| `src/Nexus.Frontend/src/shell/PanelPicker.tsx` | Create |  
| `src/Nexus.Frontend/src/pages/DashboardPage.tsx` | Create |  
| `src/Nexus.Gateway/Controllers/DashboardController.cs` | Create |  
  
---  
  
## Test Criteria  
- [ ] Dashboard at `/` shows grid with panels from default layout  
- [ ] Panels can be dragged to new positions and layout updates visually  
- [ ] After drag, layout is saved (check SQLite `dashboard_layouts` table)  
- [ ] Refresh page — saved layout is restored correctly  
- [ ] "Add Panel" shows all available plugin panels  
- [ ] Added panel persists after refresh  
- [ ] "Reset to default" clears user layout and loads plugin defaults  
- [ ] Grid is responsive (panels stack on narrow viewport)  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **13-0:** DashboardGrid base + @dnd-kit setup  
- **13-1:** DraggablePanel + resize handles  
- **13-2:** Layout serialization + auto-save  
- **13-3:** Backend layout API (GET/PUT/reset)  
- **13-4:** PanelPicker + default layout generation  
  
---  
  
## Notes for Coding Agent  
- Use `@dnd-kit/core` + `@dnd-kit/sortable` — NOT `react-grid-layout` (license concerns)  
- Panel resize: use ResizeObserver or simple drag-corner handles  
- Auto-save debounce: 1000ms after last change to avoid excessive API calls  
- Layout JSON is stored per username (from auth token)  
- Panel placeholder: show plugin name + icon in a styled card until Phase 15+ provides real content  
- The 12-column grid maps to CSS Grid: `grid-template-columns: repeat(12, 1fr)` 