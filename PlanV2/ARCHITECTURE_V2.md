# NEXUS V2 — Architecture Document

## 1. Technology Stack

### Backend (Core Gateway)
| Component | Technology | Reason |
|-----------|-----------|--------|
| Language | C# / .NET 8 | Native Windows APIs, Kerberos, DPAPI, WMI, AD |
| Web Framework | ASP.NET Core 8 Minimal API | Fast, lightweight REST + WebSocket |
| Real-time | SignalR (WebSocket) | Live terminal, metrics streaming |
| Auth | Microsoft.AspNetCore.Authentication.Negotiate | Built-in Windows Auth (Kerberos/NTLM). Massive time saver. |
| Database | SQLite via EF Core | Zero config, single file, no SQL Server needed |
| Windows Service | .NET Worker Service | Installs as native Windows Service |
| AD/DNS/DHCP | System.DirectoryServices, DnsClient.NET | Official .NET libraries |
| WinRM | Microsoft.Management.Infrastructure (CIM) | Native, battle-tested |
| Credentials | Windows DPAPI (DataProtectionAPI) | Encrypted at-rest per machine |
| Scheduler | Quartz.NET | Cron-style background jobs |
| Remote Desktop | guacd (Guacamole Daemon) | Native RDP handling without building a custom protocol |

### Frontend
| Component | Technology | Reason |
|-----------|-----------|--------|
| UI Framework | React 18 + Vite + TypeScript | Standard modern web stack |
| Application Shell | satnaing/shadcn-admin | Pre-built robust dashboard template. Replaces custom shell build. |
| UI Components | shadcn/ui | Beautiful, accessible, customizable components via `npx shadcn`. |
| Animations | Magic UI | Dashboard eye-candy and modern feel. |
| State | Zustand | Lightweight client state |
| Remote Desktop View | @guacamole/common-js | RDP canvas in React matching the backend guacd |
| Terminal | xterm.js | Industry standard web terminal |
| Charts | Recharts | Simple charting for metrics |
| Icons | Lucide React | Clean, consistent icons (bundled with shadcn) |
| HTTP | Axios | Clean API requests |
| WebSocket | SignalR JS client | Real-time connections |

### Scripts (Plugin-side, not core)
| Component | Technology | Reason |
|-----------|-----------|--------|
| Base Scripts | amidaware/community-scripts | Fork and adapt existing TRMM scripts instead of writing from scratch. |
| Languages | PowerShell 5.1/7+, Python, Batch | Flexible execution environment |

## 2. Key Architectural Decisions (V2 Overhaul)

1. **Frontend Replacement:** We will fork `satnaing/shadcn-admin`, strip out its demo pages, and use it as the foundational application shell instead of building one from scratch. This eliminates several V1 UI phases.
2. **Component Library:** `shadcn/ui` components will be used extensively via CLI addition, avoiding custom CSS components for buttons, cards, modals, tables, etc.
3. **Authentication Simplification:** Using the official Microsoft NuGet package for Negotiate/Windows Auth instead of building custom Kerberos middleware.
4. **Remote Access Strategy:** Instead of building a custom browser RDP implementation, we will use Apache Guacamole components (`guacd` as a sidecar process, `guacamole-common-js` on the frontend).
5. **Script Ecosystem:** We will seed the initial script library and plugins using existing source-available scripts (like Tactical RMM community scripts) adapted for NEXUS, significantly accelerating plugin delivery.
