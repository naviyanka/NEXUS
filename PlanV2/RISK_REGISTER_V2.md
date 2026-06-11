# NEXUS V2 — Risk Register

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R01 | `satnaing/shadcn-admin` has breaking updates. | Medium | Low | We are forking it as a baseline shell, not treating it as a live NPM dependency. We control the code once imported. |
| R02 | Guacamole daemon (`guacd`) complicated to bundle in Windows Installer. | High | Medium | Package a pre-compiled Windows port of guacd, or utilize Docker/WSL2 if natively compiling fails. Ensure fallback to pure WinRM tools if RDP fails. |
| R03 | WinRM configuration on target machines blocks connection. | High | High | Provide a clear, one-line PowerShell script for admins to run on target machines to enable WinRM and configure TrustedHosts. Document in Phase 20. |
| R04 | DPAPI encryption fails if the Service Account running NEXUS changes. | High | Low | Clearly document that the NEXUS Windows Service must run under a dedicated Domain Admin account and should not be changed without a credential re-key. |
| R05 | Community scripts contain outdated syntax or bugs. | Medium | Medium | All imported TRMM scripts must be reviewed and tested in the lab environment during Plugin development. |
| R06 | Microsoft Negotiate Auth fails in non-domain environments. | Medium | Low | Implement a fallback Local JWT authentication for machines/users outside the domain. |
