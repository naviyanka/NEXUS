using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.EntityFrameworkCore;
using Quartz;
using Nexus.Gateway.Data;
using Nexus.Gateway.Core;
using Nexus.Gateway.Hubs;

public partial class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Host.UseWindowsService();

        builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
            .AddNegotiate();

        builder.Services.AddAuthorization(options =>
        {
            options.FallbackPolicy = options.DefaultPolicy;
        });

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins("http://localhost:5173", "https://localhost:5173")
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        builder.Services.AddDbContext<NexusDbContext>(options =>
            options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

        // Core Services
        builder.Services.AddSingleton<VaultService>();
        builder.Services.AddSingleton<WinRmConnectionPool>();
        builder.Services.AddScoped<ScriptExecutor>();
        builder.Services.AddScoped<AuditLogger>();

        // Plugin Loader (Phase 5)
        builder.Services.AddSingleton<PluginLoader>();

        // Controllers
        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        // SignalR and Quartz.NET
        builder.Services.AddSignalR();
        builder.Services.AddQuartz(q =>
        {
            var jobKey = new JobKey("EventSchedulerJob");
            q.AddJob<EventSchedulerJob>(opts => opts.WithIdentity(jobKey));

            q.AddTrigger(opts => opts
                .ForJob(jobKey)
                .WithIdentity("EventSchedulerJob-trigger")
                .WithSimpleSchedule(x => x
                    .WithIntervalInMinutes(5)
                    .RepeatForever()));
        });
        builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

        var app = builder.Build();

        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<NexusDbContext>();
            db.Database.EnsureCreated();

            // Invoke the new database seeder
            DatabaseSeeder.Seed(db);

            var pluginLoader = scope.ServiceProvider.GetRequiredService<PluginLoader>();
            pluginLoader.LoadPlugins();
        }

        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseSwagger();
        app.UseSwaggerUI();

        app.MapGet("/api/auth/me", (System.Security.Claims.ClaimsPrincipal user) =>
        {
            return new
            {
                Username = user.Identity?.Name,
                IsAuthenticated = user.Identity?.IsAuthenticated,
                AuthenticationType = user.Identity?.AuthenticationType
            };
        }).RequireAuthorization();

        app.MapGet("/api/health", () => new { Status = "Healthy", Version = "2.0.0" }).AllowAnonymous();

        // Expose loaded plugins
        app.MapGet("/api/plugins", (PluginLoader loader) => loader.GetLoadedPlugins()).RequireAuthorization();

        app.MapHub<TerminalHub>("/hubs/terminal");
        app.MapControllers();

        app.Run();
    }
}
