# NEXUS Planning: V1 to V2 Executive Summary

## Overview of Changes
The NEXUS roadmap has undergone a major revision (V2) to significantly accelerate development, improve maintainability, and leverage robust open-source ecosystems.

**The primary objective of the V2 shift is to stop reinventing the wheel.**

## What Changed & Why

### 1. Frontend Shell Replacement
* **Change:** Abandoned building the React layout, sidebar, and theme engine from scratch (V1 Phases 10-13). Replaced with `satnaing/shadcn-admin`.
* **Why:** Building a responsive, accessible admin dashboard takes weeks. Forking a high-quality, MIT-licensed dashboard template provides an immediate, professional foundation.
* **Estimated Savings:** 3-4 weeks of UI development.

### 2. Component Library Adoption
* **Change:** Abandoned writing custom CSS/Tailwind for standard UI elements. Replaced with `shadcn/ui` and `Magic UI`.
* **Why:** `shadcn/ui` is the current industry standard for React components. It provides accessible, unstyled components that we can easily theme to match NEXUS.
* **Estimated Savings:** 2-3 weeks of component design and accessibility testing.

### 3. Authentication Simplification
* **Change:** Abandoned custom Kerberos/NTLM middleware implementation (V1 Phase 4). Replaced with `Microsoft.AspNetCore.Authentication.Negotiate`.
* **Why:** Microsoft provides an official, supported NuGet package that handles Windows Authentication perfectly in ASP.NET Core 8.
* **Estimated Savings:** 1-2 weeks of security development and debugging.

### 4. Remote Desktop Implementation
* **Change:** Abandoned custom browser RDP implementation. Replaced with Apache Guacamole (`guacd` + `guacamole-common-js`).
* **Why:** RDP in the browser is notoriously difficult. Guacamole is the industry standard open-source solution for this exact problem.
* **Estimated Savings:** 1-2 months of protocol engineering.

### 5. Script Seed Library
* **Change:** Abandoned writing basic PowerShell administration scripts from scratch. Replaced with adapting `amidaware/community-scripts` (Tactical RMM).
* **Why:** The community has already solved how to get Windows Update status, restart services, and clear temp files via PowerShell. We will adapt these proven scripts for the NEXUS plugin engine.
* **Estimated Savings:** 2-3 weeks of script authoring and testing.

## Structural Changes (Phase Consolidation)
By leveraging the tools above, we have reduced the total number of phases from **45 to 21**.

* **Phase Removals:** Granular UI phases (10, 11, 13) were removed and absorbed into the `shadcn-admin` integration.
* **Phase Merges:** Highly granular plugins (e.g., separate phases for DNS, DHCP, Certificates, Firewall) have been conceptually merged into logical bundles (e.g., "Phase 13: Network & Security Plugin"). This allows an agent to build the UI and backend for related features in a single, cohesive sprint.

## Risk Reductions
* **Security:** Relying on Microsoft for Auth and Guacamole for RDP drastically reduces our security surface area compared to rolling our own.
* **UI Inconsistencies:** Using `shadcn/ui` ensures pixel-perfect consistency across all plugins, which is difficult to achieve with custom CSS across 40+ plugins.

**Conclusion:** Plan V2 positions NEXUS to be built faster, run more stably, and look more professional by standing on the shoulders of modern open-source giants.
