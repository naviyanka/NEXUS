# Phase 1 — .NET 8 Windows Service Gateway (Core Host)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the core ASP.NET Core 8 host that runs as a Windows Service. This is the backbone everything else plugs into: HTTP server, routing, DI container, static file serving (for frontend), SSL, and service lifecycle. No feature logic — just a working, installable Windows Service that serves the React frontend and responds to a health check endpoint.

---

## Context: What is NEXUS?
NEXUS is a self-hosted Windows Service installed on a domain-joined server. The .NET 8 gateway is the core process that hosts the REST API, SignalR WebSocket connections, serves the React frontend, and orchestrates all plugin execution. Target machines need no agent — all operations happen via WinRM/CIM from this service.

---

## Scope
**In scope:**
- `Program.cs` — Windows Service host setup with `UseWindowsService()`
- `Startup.cs` / builder pattern — DI registrations, middleware pipeline
- ASP.NET Core minimal API setup
- Static file serving for the React build output
- HTTPS/SSL configuration (self-signed cert generation if none provided)
- Health check endpoint: `GET /api/health`
- Configuration loading from `config/nexus.yaml`
- Structured logging (Serilog → file + console)
- Windows Service install/uninstall helper scripts

**Out of scope:**
- Authentication middleware (Phase 4)
- Plugin loading (Phase 6)
- Database setup (Phase 5)
- Any API endpoints beyond `/api/health`
- Frontend content (Phase 10+)

---

## Prerequisites
- Phase 0 complete (solution structure exists)

---

## Tech Stack for This Phase
| Component | Package |
|-----------|---------|
| Host | `Microsoft.Extensions.Hosting.WindowsServices` |
| Web | `Microsoft.AspNetCore` (built into .NET 8) |
| Config | `YamlDotNet` |
| Logging | `Serilog.AspNetCore`, `Serilog.Sinks.File` |
| SSL | `System.Security.Cryptography` (self-signed gen) |

---

## Detailed Tasks

### 1. Configure Program.cs

```csharp
// src/Nexus.Gateway/Program.cs
using Serilog;
using Nexus.Gateway;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/nexus.log", rollingInterval: RollingInterval.Day)
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    
    // Run as Windows Service
    builder.Host.UseWindowsService(options =>
    {
        options.ServiceName = "NEXUS Control Hub";
    });
    
    builder.Host.UseSerilog((ctx, services, config) =>
        config.ReadFrom.Configuration(ctx.Configuration));

    // Load NEXUS config from YAML
    builder.Services.AddNexusConfiguration(builder.Configuration);
    
    // Add core services (will grow in later phases)
    builder.Services.AddControllers();
    builder.Services.AddSignalR();
    builder.Services.AddHealthChecks();
    
    // CORS for development (React dev server on different port)
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("NexusDevPolicy", policy =>
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
    });

    var app = builder.Build();

    // Middleware pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseCors("NexusDevPolicy");
    }

    app.UseDefaultFiles();
    app.UseStaticFiles();    // Serves React build from wwwroot/
    app.UseRouting();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHealthChecks("/api/health");
    
    // SPA fallback — all unknown routes serve index.html
    app.MapFallbackToFile("index.html");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "NEXUS failed to start");
}
finally
{
    Log.CloseAndFlush();
}
```

### 2. Create NexusConfiguration Model

```csharp
// src/Nexus.Gateway/Models/NexusConfig.cs
public class NexusConfig
{
    public ServiceConfig Service { get; set; } = new();
    public AuthConfig Auth { get; set; } = new();
    public PluginsConfig Plugins { get; set; } = new();
    public ThemesConfig Themes { get; set; } = new();
    public DatabaseConfig Database { get; set; } = new();
    public LoggingConfig Logging { get; set; } = new();
}

public class ServiceConfig
{
    public int Port { get; set; } = 443;
    public string Host { get; set; } = "0.0.0.0";
    public bool Ssl { get; set; } = true;
    public string? SslCertPath { get; set; }
}

public class AuthConfig
{
    public string Mode { get; set; } = "windows"; // windows | local | both
    public int SessionTimeoutMinutes { get; set; } = 480;
}

public class PluginsConfig
{
    public string Directory { get; set; } = "./plugins";
    public bool HotReload { get; set; } = true;
}

public class ThemesConfig
{
    public string Directory { get; set; } = "./themes";
    public string Active { get; set; } = "dark-default";
}

public class DatabaseConfig
{
    public string Path { get; set; } = "./data/nexus.db";
}

public class LoggingConfig
{
    public string Level { get; set; } = "Information";
    public string Path { get; set; } = "./logs/nexus.log";
    public int MaxSizeMb { get; set; } = 100;
    public int RetainDays { get; set; } = 30;
}
```

### 3. Create YAML Configuration Loader Extension

```csharp
// src/Nexus.Gateway/Core/NexusConfigExtensions.cs
public static class NexusConfigExtensions
{
    public static IServiceCollection AddNexusConfiguration(
        this IServiceCollection services, 
        IConfiguration configuration)
    {
        // Load nexus.yaml from config/ directory
        var configPath = Path.Combine(AppContext.BaseDirectory, "config", "nexus.yaml");
        
        if (File.Exists(configPath))
        {
            var yaml = File.ReadAllText(configPath);
            var deserializer = new DeserializerBuilder()
                .WithNamingConvention(UnderscoredNamingConvention.Instance)
                .Build();
            var nexusConfig = deserializer.Deserialize<NexusConfig>(yaml);
            services.AddSingleton(nexusConfig);
        }
        else
        {
            services.AddSingleton(new NexusConfig());
        }
        
        return services;
    }
}
```

### 4. Create Health Controller

```csharp
// src/Nexus.Gateway/Controllers/HealthController.cs
[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    private static readonly DateTime StartTime = DateTime.UtcNow;
    
    [HttpGet("health")]
    public IActionResult GetHealth()
    {
        return Ok(new
        {
            status = "healthy",
            service = "NEXUS Control Hub",
            version = "1.0.0",
            uptime = (DateTime.UtcNow - StartTime).ToString(@"dd\:hh\:mm\:ss"),
            timestamp = DateTime.UtcNow
        });
    }
    
    [HttpGet("version")]
    public IActionResult GetVersion()
    {
        return Ok(new { version = "1.0.0", build = "dev" });
    }
}
```

### 5. Configure Kestrel for HTTPS

```csharp
// In Program.cs — configure Kestrel
builder.WebHost.ConfigureKestrel((context, options) =>
{
    var nexusConfig = context.Configuration.Get<NexusConfig>() ?? new NexusConfig();
    
    options.Listen(IPAddress.Parse(nexusConfig.Service.Host == "0.0.0.0" 
        ? "0.0.0.0" : nexusConfig.Service.Host), nexusConfig.Service.Port, listenOptions =>
    {
        if (nexusConfig.Service.Ssl)
        {
            if (!string.IsNullOrEmpty(nexusConfig.Service.SslCertPath) 
                && File.Exists(nexusConfig.Service.SslCertPath))
            {
                listenOptions.UseHttps(nexusConfig.Service.SslCertPath);
            }
            else
            {
                // Auto-generate self-signed cert
                listenOptions.UseHttps(GenerateSelfSignedCert("nexus-host"));
            }
        }
    });
});
```

### 6. Create Self-Signed Certificate Generator

```csharp
// src/Nexus.Gateway/Core/CertificateHelper.cs
public static class CertificateHelper
{
    public static X509Certificate2 GenerateSelfSignedCert(string subjectName)
    {
        var certPath = Path.Combine(AppContext.BaseDirectory, "data", "nexus.pfx");
        
        // Reuse existing cert if valid
        if (File.Exists(certPath))
        {
            var existing = new X509Certificate2(certPath);
            if (existing.NotAfter > DateTime.UtcNow.AddDays(30))
                return existing;
        }

        using var rsa = RSA.Create(2048);
        var req = new CertificateRequest(
            $"CN={subjectName}", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        
        req.CertificateExtensions.Add(
            new X509BasicConstraintsExtension(false, false, 0, false));
        req.CertificateExtensions.Add(
            new X509KeyUsageExtension(X509KeyUsageFlags.DigitalSignature, false));
        req.CertificateExtensions.Add(
            new X509EnhancedKeyUsageExtension(
                new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false));

        var cert = req.CreateSelfSigned(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddYears(2));
        
        Directory.CreateDirectory(Path.GetDirectoryName(certPath)!);
        File.WriteAllBytes(certPath, cert.Export(X509ContentType.Pfx));
        
        return cert;
    }
}
```

### 7. Windows Service Install Scripts

**installer/install-service.ps1:**
```powershell
# Run as Administrator
param([string]$InstallPath = "C:\NEXUS")

$ServiceName = "NexusControlHub"
$ExePath = Join-Path $InstallPath "nexus.exe"

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
    Stop-Service -Name $ServiceName -Force
    sc.exe delete $ServiceName
}

New-Service -Name $ServiceName `
            -BinaryPathName $ExePath `
            -DisplayName "NEXUS Control Hub" `
            -Description "NEXUS - Network EXecution & Unified Server-hub" `
            -StartupType Automatic

Start-Service -Name $ServiceName
Write-Host "NEXUS service installed and started" -ForegroundColor Green
Write-Host "Access at: https://localhost" -ForegroundColor Cyan
```

**installer/uninstall-service.ps1:**
```powershell
$ServiceName = "NexusControlHub"
Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
sc.exe delete $ServiceName
Write-Host "NEXUS service removed" -ForegroundColor Yellow
```

### 8. Configure Static Files for React Output

```csharp
// In Program.cs — serve React build output
var wwwrootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot");
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(wwwrootPath),
    RequestPath = ""
});
```

During development, React runs on its own dev server (port 5173). In production, `npm run build` output is copied to `src/Nexus.Gateway/wwwroot/`.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/Nexus.Gateway/Program.cs` | Create |
| `src/Nexus.Gateway/Models/NexusConfig.cs` | Create |
| `src/Nexus.Gateway/Core/NexusConfigExtensions.cs` | Create |
| `src/Nexus.Gateway/Core/CertificateHelper.cs` | Create |
| `src/Nexus.Gateway/Controllers/HealthController.cs` | Create |
| `src/Nexus.Gateway/Nexus.Gateway.csproj` | Modify (add packages) |
| `installer/install-service.ps1` | Create |
| `installer/uninstall-service.ps1` | Create |

---

## Integration Points
- **Phase 5 (Database):** Will add `DbContext` to DI in `Program.cs`
- **Phase 6 (Plugin Loader):** Will register `PluginLoader` singleton in DI
- **Phase 7 (WebSocket):** Will add `hub.MapHub<TerminalHub>()` to routing
- **Phase 10 (Frontend):** React build output goes to `wwwroot/`

---

## Test Criteria
- [ ] `dotnet run` starts without errors
- [ ] `GET https://localhost/api/health` returns `200 OK` with JSON body
- [ ] `GET https://localhost/api/version` returns version info
- [ ] Self-signed certificate is generated in `data/nexus.pfx` on first run
- [ ] Service installs successfully via `install-service.ps1` on Windows
- [ ] Installed service appears in `services.msc` with name "NEXUS Control Hub"
- [ ] Service starts automatically and serves health endpoint after reboot
- [ ] Serilog writes to `logs/nexus.log`

---

## Sub-Phase Breakdown (if needed)
- **1-0:** `Program.cs` host setup + Windows Service configuration
- **1-1:** NexusConfig model + YAML loader
- **1-2:** Health controller + Kestrel HTTPS
- **1-3:** Self-signed cert generation
- **1-4:** Windows Service install/uninstall scripts

---

## Notes for Coding Agent
- Use `WebApplication.CreateBuilder(args)` not the older `IHostBuilder` pattern
- `UseWindowsService()` must be called — this is what enables native SC.exe management
- The `wwwroot/` directory inside the project will be empty until Phase 10 builds the frontend
- Do NOT put any feature logic here — this phase is plumbing only
- The `data/` directory needs to be created at runtime if it doesn't exist
- Kestrel port default is 443 but during development use 5000/5001 to avoid needing elevated privileges
