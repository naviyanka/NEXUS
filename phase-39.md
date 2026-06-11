# Phase 39 — NEXUS Exclusive Plugins Batch 2

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Develop additional NEXUS-exclusive capabilities focusing on advanced visualization and automated reporting. Specifically, build the `farm-diagram` and `health-report` plugins to generate visual network topologies and exportable PDF health assessments.

---

## Context: What is NEXUS?
System administrators are frequently asked by management to provide "farm architecture diagrams" and "monthly health reports." These are usually compiled manually in Visio and Word, taking hours. Phase 39 automates this by utilizing the data NEXUS already collects to dynamically generate these artifacts, saving significant administrative time.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- **Farm Diagram Plugin (`plugins/farm-diagram/plugin.json`)**:
  - Automatically draws a Mermaid.js or React Flow diagram of the farm.
  - Shows gateways, web front-ends, application servers, search servers, and SQL databases.
  - Indicates network boundaries or AD domains based on collected data.
- **Health Report Plugin (`plugins/health-report/plugin.json`)**:
  - Aggregates data from Phase 19 (Performance), Phase 33 (Defender), Phase 34 (SP Health), and Phase 23 (Windows Update).
  - Generates a polished, printable HTML/PDF report.
  - Includes an executive summary (e.g., "3 machines require updates, 1 machine low on disk space").

**Out of scope:**
- Sending automated emails (Reporting is generated on-demand via the UI; scheduled emails might be a future background task feature).
- Manual drag-and-drop Visio-style editing (The diagram is auto-generated).

---

## Prerequisites
- Phase 12 (Plugin Renderer)
- Phase 14 (Machine Management)
- Dependent on data from Phases 19, 23, 33, 34.

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Plugin manifests | `plugin.json` (Phase 6 schema) |
| Diagram Engine | `reactflow` or `mermaid.js` |
| PDF Generation | `jspdf` or `html2pdf.js` |
| UI components | React 18 + TypeScript |

---

## Detailed Tasks

### 1. Create Plugin Manifests

```json
// plugins/farm-diagram/plugin.json
{
  "id": "farm-diagram",
  "name": "Farm Architecture",
  "description": "Auto-generate visual diagrams of the server farm topology.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "Exclusive",
  "icon": "share-2",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "diagram",
        "title": "Architecture Diagram",
        "icon": "share-2",
        "component": "ui/Tool",
        "sidebar_group": "Exclusive",
        "sidebar_order": 25
      }
    ]
  },
  "permissions": {}
}
```

```json
// plugins/health-report/plugin.json
{
  "id": "health-report",
  "name": "Health Report",
  "description": "Generate comprehensive PDF health reports for the environment.",
  "version": "1.0.0",
  "author": "NEXUS Built-in",
  "category": "Exclusive",
  "icon": "file-text",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "report",
        "title": "Generate Report",
        "icon": "file-text",
        "component": "ui/Tool",
        "sidebar_group": "Exclusive",
        "sidebar_order": 26
      }
    ]
  },
  "permissions": {}
}
```

### 2. Create UI Components

**Farm Diagram UI:**
- Uses React Flow.
- Nodes represent machines (styled based on Role — DB, WFE, APP).
- Edges represent logical connections (e.g., all WFEs point to the Load Balancer/Gateway; all SP servers point to the SQL server).

**Health Report UI:**
- A "Generate Report" button that fetches cached data from the NEXUS backend.
- A hidden HTML template that gets populated with the data.
- Converts the HTML to a downloadable PDF.

### 3. Create Plugin READMEs

Create `README.md` for both plugins explaining the libraries used for generation.

---

## Files to Create/Modify
- `plugins/farm-diagram/plugin.json`
- `plugins/farm-diagram/ui/Tool.tsx`
- `plugins/health-report/plugin.json`
- `plugins/health-report/ui/Tool.tsx`
- `plugins/health-report/utils/pdf-generator.ts`

---

## Test Criteria
- [ ] Farm diagram accurately renders all registered machines based on their assigned tags/roles.
- [ ] Health Report successfully exports a readable PDF.

---

## Sub-Phase Breakdown (if needed)
- **39-0:** Plugin manifest + README + folder structure
- **39-1:** Scripts implementation
- **39-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.


