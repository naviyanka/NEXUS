# Phase 44 — Documentation & Deployment Guide

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Create comprehensive, polished documentation for NEXUS. This includes end-user manuals, installation guides for system administrators, and a developer guide for authoring custom plugins.

---

## Context: What is NEXUS?
A powerful tool is only as good as its documentation. For other teams to adopt NEXUS, they need to know how to install it, how to configure WinRM on their target servers, and how to write their own custom plugins for internal company scripts. Phase 44 finalizes the project with professional markdown documentation.

---

## Scope
**In scope:**
- `docs/Installation.md`: Step-by-step guide on running `NEXUS-Setup.exe` and configuring the initial Administrator account.
- `docs/WinRM-Configuration.md`: Critical documentation providing the exact PowerShell commands (`Enable-PSRemoting`) required to prepare target servers to be managed by NEXUS.
- `docs/User-Guide.md`: Overview of the UI, how to add machines, and how to use the built-in system plugins.
- `docs/Plugin-Development.md`: A comprehensive guide on the `plugin.json` schema, how to structure the React UI components, and how to write the backing PowerShell scripts to extend NEXUS.
- `README.md`: The main repository landing page summarizing the project, features, and architecture.

**Out of scope:**
- Video tutorials.
- Interactive web-based help inside the application (Focus on markdown files in the repository first).

---

## Prerequisites
- All previous phases.

---

## Detailed Tasks

### 1. The WinRM Configuration Guide
This is the most critical document. It must explicitly detail:
- How to enable WinRM over HTTPS (recommended) or HTTP.
- How to configure `TrustedHosts` if not using a strict Active Directory domain environment.
- How to ensure the Windows Firewall allows port 5985/5986 inbound.

### 2. The Plugin Development Guide
This document must provide a "Hello World" plugin example.
- Example `plugin.json`
- Example `ui/Tool.tsx`
- Example `scripts/hello.ps1`
- Instructions on where to drop the folder so NEXUS loads it dynamically on the next refresh.

### 3. Polish the Main README
- Add badges (Build passing, Version).
- Add screenshots of the gorgeous Tailwind UI (Dashboard, Remote Terminal, Registry Editor).
- Add an architecture diagram showing the Browser -> .NET Minimal API -> WinRM -> Target Server flow.

---

## Files to Create/Modify
- `README.md`
- `docs/Installation.md`
- `docs/WinRM-Configuration.md`
- `docs/User-Guide.md`
- `docs/Plugin-Development.md`

---

## Test Criteria
- [ ] A developer completely unfamiliar with the project can read `Plugin-Development.md` and successfully write a basic plugin that runs a PowerShell command and displays the output in the NEXUS UI.
- [ ] The `WinRM-Configuration.md` script block can be copy-pasted onto a fresh Windows Server and successfully prepares it for NEXUS management.

---

## Sub-Phase Breakdown (if needed)
- **44-0:** Plugin manifest + README + folder structure
- **44-1:** Scripts implementation
- **44-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.

