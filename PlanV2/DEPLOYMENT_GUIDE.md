# NEXUS Deployment Guide

## Prerequisites
- Target host must be a domain-joined Windows Server (DC recommended for labs).
- .NET 8 Hosting Bundle must be installed.
- Target machines must have WinRM enabled (`Enable-PSRemoting`).

## Installation
1. Run `NEXUS_Setup.exe` generated via `build.ps1` -> `Inno Setup`.
2. The installer maps the `NexusGateway` Windows Service.
3. Access `http://localhost:5000` from any browser on the domain to authenticate via Kerberos/NTLM automatically.

## Plugin Installation
1. Drop valid plugin folders inside `C:\Program Files\NEXUS\plugins`.
2. Restart the `NexusGateway` service.
