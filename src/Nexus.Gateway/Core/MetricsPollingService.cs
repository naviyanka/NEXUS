using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Nexus.Gateway.Hubs;
using System.Text.Json;

namespace Nexus.Gateway.Core;

public class MetricsPollingService : BackgroundService
{
    private readonly ILogger<MetricsPollingService> _logger;
    private readonly IHubContext<MetricsHub> _hubContext;
    private readonly MetricsSubscriptionManager _manager;
    private readonly IServiceProvider _serviceProvider;

    public MetricsPollingService(
        ILogger<MetricsPollingService> logger,
        IHubContext<MetricsHub> hubContext,
        MetricsSubscriptionManager manager,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _hubContext = hubContext;
        _manager = manager;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var activeHosts = _manager.GetActiveMachines().ToList();
            if (activeHosts.Any())
            {
                using var scope = _serviceProvider.CreateScope();
                var executor = scope.ServiceProvider.GetRequiredService<ScriptExecutor>();

                // Define script explicitly returning single generic structured payload mapped
                var script = @"
                    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
                    $os = Get-CimInstance Win32_OperatingSystem
                    $ram = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / $os.TotalVisibleMemorySize * 100, 1)
                    $disk = (Get-PSDrive C | Select-Object @{N='UsedPct';E={[math]::Round($_.Used/($_.Used+$_.Free)*100,1)}}).UsedPct
                    $net = (Get-NetAdapterStatistics | Select-Object ReceivedBytes,SentBytes | Measure-Object -Sum ReceivedBytes,SentBytes).Sum

                    @{
                        CPU = $cpu
                        RAM = $ram
                        Disk = $disk
                        Network = $net
                    } | ConvertTo-Json
                ";

                var tasks = activeHosts.Select(async host =>
                {
                    try
                    {
                        var result = await executor.ExecutePowerShellAsync(script, host);
                        if (result.Success)
                        {
                            var metrics = JsonSerializer.Deserialize<object>(result.Output);
                            await _hubContext.Clients.Group($"metrics-{host}").SendAsync("ReceiveMetrics", metrics, cancellationToken: stoppingToken);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to poll metrics for host {Hostname}", host);
                    }
                });

                await Task.WhenAll(tasks);
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
