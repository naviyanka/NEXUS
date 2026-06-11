# NEXUS V2 — Master Overview Document
**Network EXecution & Unified Server-hub**

> This is the single source of truth for the NEXUS V2 project.
> Every phase plan, every plugin, every design decision references back to this file.
> Coding agents should read this file FIRST before working on any phase.

---

## 1. What is NEXUS?

NEXUS is a self-hosted, browser-based IT control hub for Windows Server lab environments. It is installed as a **Windows Service** on any domain-joined server (typically the DC) and provides a unified web interface to monitor, manage, and automate every machine in the domain — with zero agent installation on target machines.

**Target environment:**
- 1 Domain Controller (DC01)
- 1 SQL Server (SQL01)
- 1 Windows 11 Pro Client (WIN11-CLIENT)
- 3 SharePoint farms (SPSE, SP2019, SP2016), each with 1 WFE + 1 APP server
- All machines: Windows, domain-joined, WinRM-enabled

**Primary users:** IT administrators and lab owners who want Windows Admin Center parity + SharePoint-specific tools + lab-exclusive features in a single, extensible, self-hosted tool.

---

## 2. Core Design Principles

| Principle | Description |
|-----------|-------------|
| **Zero Agent** | Target machines need no software installed. All communication via WinRM/CIM/PS Remoting. |
| **Plugin-First** | Every feature is a plugin. Core app is a shell. Adding a feature = dropping a folder. |
| **Leverage Open Source** | Do not reinvent the wheel. Utilize `shadcn-admin`, Microsoft Negotiate NuGet, Guacamole, and existing community scripts to drastically reduce build time. |
| **WAC Parity** | Every feature in Windows Admin Center is replicated as a NEXUS plugin. |
| **NEXUS Exclusive** | Features WAC doesn't have: multi-machine ops, SP config diff, lab snapshot, topology view, etc. |
| **Theme System** | Full CSS token-based theming via `shadcn/ui`. |
| **Single Installer** | One `.exe` produced by Inno Setup. Installs everything. Runs as Windows Service. Domain admin installs in minutes. |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  NEXUS Host Server (domain-joined Windows Server / DC)          │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  NEXUS Windows Service (nexus.exe)                      │    │
│  │                                                         │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐ │    │
│  │  │  ASP.NET     │  │  Plugin      │  │  Script       │ │    │
│  │  │  Core 8      │  │  Manager     │  │  Engine       │ │    │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘ │    │
│  │         │                │                 │          │    │
│  │  ┌──────┴──────┐  ┌──────┴───────┐  ┌──────┴────────┐ │    │
│  │  │  WinRM/CIM   │  │ SQLite DB   │  │ Guacd Daemon   │ │    │
│  │  │  Connection  │  │ (EF Core)   │  │ (Remote Access)│ │    │
│  │  └──────┬──────┘  └──────────────┘  └──────┬────────┘ │    │
│  └─────────┼──────────────────────────────────┼──────────┘    │
│            │                                  │               │
└────────────┼──────────────────────────────────┼───────────────┘
             │                                  │
      Kerberos/NTLM via                  RDP Protocol
      Microsoft.AspNetCore               over WebSockets
      .Authentication.Negotiate                 │
             │                                  │
      ┌──────┴──────────────────────────────────┴──────┐
      │  Browser Client (IT Admin PC)                  │
      │  React 18 + Vite + shadcn-admin + Tailwind     │
      └────────────────────────────────────────────────┘
```
