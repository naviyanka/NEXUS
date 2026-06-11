# NEXUS V2 — Development Roadmap & Phase Breakdown

*This roadmap has been significantly optimized by leveraging open-source components.*

## Phase Group 1: Core Infrastructure
| Phase | Name | Description |
|---|---|---|
| Phase 0 | Solution & Repository Scaffold | Setup .NET 8 solution, Git repo, initial directory structure. |
| Phase 1 | .NET 8 Gateway & Auth | Setup backend minimal APIs and `Microsoft.AspNetCore.Authentication.Negotiate` |
| Phase 2 | SQLite DB & DPAPI Vault | Setup EF Core and Windows DPAPI encrypted credentials manager. |
| Phase 3 | WinRM Connection Engine & Script Executor | Build the WinRM/CIM connection pool and generic script runner. |
| Phase 4 | SignalR & Event Scheduler | Setup WebSockets and Quartz.NET for scheduled jobs. |
| Phase 5 | Plugin Loader Engine | The C# system to dynamically load plugin manifests and routes. |

## Phase Group 2: Frontend Foundation
| Phase | Name | Description |
|---|---|---|
| Phase 6 | shadcn-admin Integration | Fork `satnaing/shadcn-admin`, strip demo pages, wire to NEXUS state. |
| Phase 7 | shadcn/ui & Theme System | Add core shadcn components, setup CSS variables for the theme system. |
| Phase 8 | Plugin Renderer System | React system to dynamically inject plugin UIs into the admin shell. |

## Phase Group 3: Core Plugins (WAC Parity)
*Note: Script logic seeded from TRMM community scripts where applicable.*
| Phase | Name | Description |
|---|---|---|
| Phase 9 | Machine & Group Manager | CRUD for target servers, Dashboard Grid overview. |
| Phase 10 | Remote Terminal & Desktop | xterm.js integration + Guacamole implementation for RDP. |
| Phase 11 | Windows Core Tools Plugin | Service Manager, Process Manager, File Browser, Event Viewer. |
| Phase 12 | OS Maintenance Plugin | Windows Update, Scheduled Tasks, Registry Editor. |
| Phase 13 | Network & Security Plugin | Firewall Manager, Certificates, Defender Settings, IP/DNS/DHCP Config. |
| Phase 14 | Active Directory Plugin | Domain users, groups, computer management. |

## Phase Group 4: NEXUS Exclusives
| Phase | Name | Description |
|---|---|---|
| Phase 15 | SharePoint Farm Health Plugin | Topology, IIS, Services overview for SP farms. |
| Phase 16 | SharePoint Config Diff | Compare configuration across WFE/APP servers to find discrepancies. |
| Phase 17 | Script Library & Runner Plugin | Save, edit, and execute scripts ad-hoc. Includes TRMM seeded scripts. |
| Phase 18 | Multi-Machine Orchestration | Execute commands/scripts across multiple machines simultaneously. |

## Phase Group 5: Delivery
| Phase | Name | Description |
|---|---|---|
| Phase 19 | Inno Setup Installer | Create the single `NEXUS-Setup.exe` installer for the Windows Service and guacd. |
| Phase 20 | Final QA & Documentation | Testing, deployment guides, user manual. |
