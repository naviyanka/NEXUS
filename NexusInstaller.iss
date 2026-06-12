[Setup]
AppName=NEXUS
AppVersion=2.0.0
DefaultDirName={pf}\NEXUS
DefaultGroupName=NEXUS
OutputDir=Installer
OutputBaseFilename=NEXUS_Setup

[Files]
Source: "src\Nexus.Gateway\bin\Release\net8.0\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "src\Nexus.Frontend\dist\*"; DestDir: "{app}\wwwroot"; Flags: ignoreversion recursesubdirs createallsubdirs

[Run]
Filename: "{sys}\sc.exe"; Parameters: "create NexusGateway binPath= ""{app}\Nexus.Gateway.exe"" start= auto"; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "start NexusGateway"; Flags: runhidden

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop NexusGateway"; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "delete NexusGateway"; Flags: runhidden
