# Phase 43 — Testing & Quality Assurance

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Implement a robust testing strategy for the NEXUS platform. Ensure stability of the .NET backend API, verify WinRM connection resilience, and validate the React frontend components.

---

## Context: What is NEXUS?
Because NEXUS is an administrative tool with Domain Admin privileges executing raw PowerShell, a bug could have catastrophic consequences (e.g., executing a script on the wrong machine, or parsing an error incorrectly). Phase 43 focuses on test coverage for the core execution engines to ensure safety and reliability.

---

## Scope
**In scope:**
- **Backend Unit Tests (xUnit)**:
  - Mocking the `PSRunspace` to test script execution logic without actually running destructive commands.
  - Testing the `ConnectionEngine` for proper connection pooling and WinRM authentication parsing.
  - Testing the SQLite database repository layer.
- **Frontend Unit Tests (Jest/React Testing Library)**:
  - Testing the Zustand state store (ensuring machines are added/removed correctly).
  - Testing the dynamic `PluginRenderer` component.
- **End-to-End Tests (Playwright)**:
  - Automating the browser to test the full lifecycle: Login -> Navigate to Dashboard -> Open Plugin -> Verify data renders.

**Out of scope:**
- 100% Code Coverage (Focus on core infrastructure: Authentication, WinRM execution, and Plugin loading. Individual plugin UI testing is lower priority).
- Destructive E2E testing on production domains.

---

## Prerequisites
- Phase 1-14 (Core Architecture) must be complete.

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Backend Tests | xUnit, Moq |
| Frontend Tests | Jest, React Testing Library |
| E2E Tests | Playwright |

---

## Detailed Tasks

### 1. Setup Backend Testing Project

```bash
dotnet new xunit -n Nexus.Tests
dotnet add Nexus.Tests reference Nexus.Backend
```

**Example Test: `ScriptExecutorTests.cs`**
- Test that a script timeout correctly throws a cancellation exception.
- Test that standard error streams from PowerShell are correctly mapped to the JSON error response.

### 2. Setup Frontend Testing

```json
// Add to frontend package.json
"scripts": {
  "test": "jest",
  "test:e2e": "playwright test"
}
```

**Example Test: `PluginRenderer.test.tsx`**
- Test that an invalid `plugin.json` fails gracefully and shows a "Plugin Failed to Load" boundary error instead of crashing the whole React app.

### 3. Setup Playwright E2E

**Example Test: `login.spec.ts`**
- Navigate to `/login`.
- Enter valid AD credentials.
- Verify redirect to `/dashboard`.
- Verify the "Welcome" message appears.

---

## Files to Create/Modify
- `Backend/Nexus.Tests/*`
- `frontend/src/__tests__/*`
- `frontend/e2e/*`

---

## Test Criteria
- [ ] `dotnet test` runs successfully and passes all backend tests.
- [ ] `npm test` runs successfully and passes all frontend tests.
- [ ] Playwright can successfully perform a headless login and dashboard navigation test.

---

## Sub-Phase Breakdown (if needed)
- **43-0:** Plugin manifest + README + folder structure
- **43-1:** Scripts implementation
- **43-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.

