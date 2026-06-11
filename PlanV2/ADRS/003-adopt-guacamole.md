# ADR 003: Adopt Apache Guacamole for RDP

**Date:** 2024-06-11
**Status:** Accepted

## Context
NEXUS aims to provide a Remote Desktop feature within the browser. Building a custom HTML5 RDP client and corresponding backend proxy is extremely complex and error-prone.

## Decision
We will adopt components of the Apache Guacamole project: `guacd` as a sidecar daemon running alongside the NEXUS service, and `@guacamole/common-js` on the frontend React client.

## Consequences
**Positive:**
- Leverages an industry-standard, battle-tested remote desktop protocol over WebSockets.
- Supports not just RDP, but potentially SSH and VNC in the future.

**Negative:**
- Introduces a non-.NET dependency (`guacd`) that must be packaged and managed by the NEXUS installer (Phase 19).
