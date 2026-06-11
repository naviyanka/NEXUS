# Phase 42 — Installer (Inno Setup)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Create `NEXUS-Setup.exe` — a streamlined, one-click installer for the NEXUS Gateway. The installer will deploy the compiled .NET 8 background service, the React frontend assets, and automatically register and start the Windows Service on the host machine.

---

## Context: What is NEXUS?
While developers can run `dotnet run` and `npm start`, end-users (System Administrators) expect a professional, self-contained Windows Installer. Phase 42 packages all the work from Phases 1 through 41 into a single deployable `.exe`. It utilizes Inno Setup to create a standard installation wizard that handles file extraction, firewall exceptions (if needed), and service registration (`sc.exe`).

---

## Scope
**In scope:**
- `build.ps1` — Master build script to compile the .NET backend (`dotnet publish`) and React frontend (`npm run build`).
- `NexusInstaller.iss` — Inno Setup script configuration.
- Installer UI: Welcome, License Agreement, Select Destination Directory, Install, Finish.
- Windows Service Registration: Creating the `NexusGateway` Windows Service during install and configuring it to auto-start.
- Post-install actions: Opening the default browser to `http://localhost:5000` upon completion.
- Uninstaller logic: Stopping the service, deleting files, and unregistering the service safely.

**Out of scope:**
- MSIX Packaging (Focus on a traditional `.exe` via Inno Setup for broader server compatibility).
- Bundling the entire .NET 8 Runtime inside the installer (We will rely on Framework-Dependent deployments and check if .NET 8 Hosting Bundle is installed, or instruct the user).

---

## Prerequisites
- All previous development phases must be essentially complete.
- Inno Setup compiler installed on the build machine.

---

## Tech Stack for This Phase
| Component | Tech |
|-----------|------|
| Build Automation | PowerShell (`build.ps1`) |
| Installer Engine | Inno Setup 6.x (`.iss`) |
| Service Registration | `sc.exe` / native Inno Setup service directives |

---

## Detailed Tasks

### 1. Create the Master Build Script

```powershell
# build.ps1
# 1. Clean previous builds
# 2. Build React Frontend (npm run build)
# 3. Copy React build output to the .NET wwwroot directory
# 4. Publish .NET 8 app (dotnet publish -c Release -r win-x64 --self-contained false)
# 5. Compile Inno Setup Script (ISCC.exe NexusInstaller.iss)
```

### 2. Create the Inno Setup Script

```pascal
; NexusInstaller.iss
[Setup]
AppName=NEXUS IT Control Hub
AppVersion=1.0.0
DefaultDirName={pf}\NEXUS
DefaultGroupName=NEXUS
OutputDir=.\Output
OutputBaseFilename=NEXUS-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Files]
; Include the published .NET output
Source: "Backend\bin\Release\net8.0\win-x64\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
; Install and Start the Windows Service
Filename: "{sys}\sc.exe"; Parameters: "create NexusGateway binPath= ""{app}\Nexus.Backend.exe"" start= auto DisplayName= ""NEXUS IT Control Hub"""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start NexusGateway"; Flags: runhidden

[UninstallRun]
; Stop and Delete the Windows Service
Filename: "{sys}\sc.exe"; Parameters: "stop NexusGateway"; Flags: runhidden; RunOnceId: "StopService"
Filename: "{sys}\sc.exe"; Parameters: "delete NexusGateway"; Flags: runhidden; RunOnceId: "DeleteService"
```

## Installer Hardening Checklist (Inno Setup + Pre-flight)

### Pre-Install Validation Script

```pascal
// Inno Setup Pascal — pre-install checks
function InitializeSetup(): Boolean;
begin
  Result := True;

  // 1. .NET 8 Runtime Detection
  if not IsDotNetInstalled(net80, 0) then begin
    MsgBox('NEXUS requires .NET 8 Runtime. Please install it first.' + #13#10 +
           'Download: https://aka.ms/dotnet/8/download', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 2. Port 5000 Conflict Check
  if IsPortInUse(5000) then begin
    MsgBox('Port 5000 is in use by another process. ' +
           'Free this port before installing NEXUS.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  // 3. Windows Version Check (Server 2016+ or Win 10+)
  if not (GetWindowsVersion >= $0A000000) then begin
    MsgBox('NEXUS requires Windows 10 / Server 2016 or later.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
end;
```

### Windows Service Configuration

```xml
<!-- Inno Setup [Run] section — service with recovery policy -->
Filename: "sc.exe"; Parameters: "create NexusService binPath= ""{app}\NexusService.exe"" start= auto DisplayName= ""NEXUS Management Service"""
Filename: "sc.exe"; Parameters: "failure NexusService reset= 86400 actions= restart/5000/restart/10000/restart/30000"
```

Recovery Policy:
- Failure 1: Restart after 5 seconds
- Failure 2: Restart after 10 seconds
- Failure 3: Restart after 30 seconds
- Reset failure count after: 24 hours

### Firewall Rule Validation

```powershell
# Run post-install — verify or create firewall rules
$ruleName = "NEXUS Management Service"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 5000 `
        -Action Allow `
        -Profile Domain,Private
}
```

### Uninstall Cleanup

- Stop and remove Windows Service
- Remove firewall rules
- Optionally preserve: `nexus.db`, `vault.export.json`, `config/`
- Prompt user before deleting data directory

---

## Files to Create/Modify
- `build.ps1`
- `NexusInstaller.iss`
- Add an `assets/` folder for installer icons (`.ico`) and banner images.

---

## Test Criteria
- [ ] Running `NEXUS-Setup.exe` on a clean Windows Server 2022 machine successfully installs the application.
- [ ] The `NexusGateway` service appears in `services.msc` and is running.
- [ ] Navigating to `http://localhost:5000` loads the NEXUS UI.
- [ ] Running the uninstaller completely removes the service and the directory from `Program Files`.

---

## Sub-Phase Breakdown (if needed)
- **42-0:** Plugin manifest + README + folder structure
- **42-1:** Scripts implementation
- **42-2:** UI components and state management

---

## Notes for Coding Agent
- Ensure all PowerShell scripts handle WinRM errors gracefully.
- Follow standard Nexus React component structure.

