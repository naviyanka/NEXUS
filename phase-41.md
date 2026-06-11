# Phase 41 — Alert Manager & Audit Log Plugin

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build a centralized alerting system and an audit log viewer. The `audit-log` provides accountability by tracking every script executed and action taken through NEXUS. The `alert-manager` allows administrators to define thresholds (e.g., CPU > 90%) that trigger notifications.

---

## Context: What is NEXUS?
A tool that can remotely execute PowerShell as a Domain Admin requires strict auditing. Phase 41 builds the UI to view the backend SQLite `audit_log` table (populated by Phase 3 Script Executor). It also introduces proactive monitoring via custom alerts based on plugin data.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- **Audit Log (`plugins/audit-log/plugin.json`)**:
  - Data grid displaying: Timestamp, User, Machine, Plugin, Action, Script Name, Success/Fail.
  - Filtering by date range, user, or machine.
  - Export to CSV.
- **Alert Manager (`plugins/alert-manager/plugin.json`)**:
  - Define custom alert rules based on dashboard metrics (e.g., "If Performance Plugin reports CPU > 90% for 5 mins").
  - View triggered alerts.
  - Acknowledging/Clearing alerts.

**Out of scope:**
- Forwarding logs to external SIEMs (Syslog/Splunk integration) - *this could be a future plugin*.
- Email/SMS notifications (initial version focuses on UI alerts).

---

## Prerequisites
- Phase 3 (Script Executor — must be logging executions to SQLite)
- Phase 5 (SQLite Database Layer)
- Phase 9 (Event Bus — for pushing real-time alerts to the UI)

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Backend | C# (Entity Framework Core `AuditLogs` DbSet) |
| UI components | React 18 + TypeScript |

---

## Detailed Tasks

### 1. Create Plugin Manifests

```json
// plugins/audit-log/plugin.json
{
  "id": "audit-log",
  "name": "Audit Logs",
  "description": "View the history of all actions executed through NEXUS.",
  "version": "1.0.0",
  "author": "NEXUS Core",
  "category": "Settings",
  "icon": "clipboard-list",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "audit",
        "title": "Audit Logs",
        "icon": "clipboard-list",
        "component": "ui/Tool",
        "sidebar_group": "Settings",
        "sidebar_order": 92
      }
    ]
  },
  "permissions": {}
}
```

```json
// plugins/alert-manager/plugin.json
{
  "id": "alert-manager",
  "name": "Alerts",
  "description": "Configure and view system alerts and thresholds.",
  "version": "1.0.0",
  "author": "NEXUS Core",
  "category": "System",
  "icon": "bell",
  "min_nexus_version": "1.0.0",

  "contributes": {
    "tools": [
      {
        "id": "alerts",
        "title": "Alerts",
        "icon": "bell",
        "component": "ui/Tool",
        "sidebar_group": "System",
        "sidebar_order": 2
      }
    ]
  },
  "permissions": {}
}
```

### 2. Create Sidebar Tool Components

**Audit Log UI:**
- Server-side paginated data table (fetching thousands of logs to the client will crash the browser).
- Search bar that queries the backend API (`GET /api/system/audit?search=xyz`).

**Alert Manager UI:**
- A list of active alerts at the top.
- A "Rule Configuration" section at the bottom to define thresholds.
- Integrates with the top navigation bar (a bell icon with a red notification dot).

### 3. Backend API Integration
- Create `AuditController.cs` in the backend to expose the Entity Framework data securely to the frontend.

---

## Files to Create/Modify
- `plugins/audit-log/*`
- `plugins/alert-manager/*`
- `Backend/Controllers/AuditController.cs` (if not already existing)

---

## Test Criteria
- [ ] Executing a script via the "Service Manager" plugin immediately generates a row in the Audit Log.
- [ ] Audit Log pagination works correctly.

---

## Sub-Phase Breakdown (if needed)
- **41-0:** Plugin manifest + README + folder structure
- **41-1:** Scripts implementation
- **41-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.


