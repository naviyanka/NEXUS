# ADR 001: Adopt shadcn-admin for Frontend Shell

**Date:** 2024-06-11
**Status:** Accepted

## Context
The original V1 roadmap included multiple phases (Phase 10-13) dedicated to building a React frontend shell from scratch, including layout, routing, sidebar, topbar, and a theme engine using CSS tokens. This represents a significant amount of boilerplate UI work before business value (managing servers) is delivered.

## Decision
We will fork `satnaing/shadcn-admin` and use it as the foundational application shell for NEXUS V2. We will strip out its demo pages and dummy data, retaining the core layout, routing infrastructure, authentication shell, and theming capabilities.

## Consequences
**Positive:**
- Drastically reduces time to first usable UI.
- Provides a professional, tested, and accessible UI out of the box.
- Integrates perfectly with `shadcn/ui` components, which we are also adopting.

**Negative:**
- We inherit the specific architectural choices of the template (e.g., how routing is structured), which we must adapt to the NEXUS Plugin Renderer system.
