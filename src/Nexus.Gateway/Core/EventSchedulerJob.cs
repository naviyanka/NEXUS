using Quartz;
using Microsoft.Extensions.Logging;

namespace Nexus.Gateway.Core;

[DisallowConcurrentExecution]
public class EventSchedulerJob : IJob
{
    private readonly ILogger<EventSchedulerJob> _logger;

    public EventSchedulerJob(ILogger<EventSchedulerJob> logger)
    {
        _logger = logger;
    }

    public Task Execute(IJobExecutionContext context)
    {
        _logger.LogInformation("Event Scheduler executing at {Time}", DateTimeOffset.Now);
        return Task.CompletedTask;
    }
}
