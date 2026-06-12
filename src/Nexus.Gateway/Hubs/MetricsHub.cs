using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Nexus.Gateway.Core;

namespace Nexus.Gateway.Hubs;

[Authorize]
public class MetricsHub : Hub
{
    private readonly MetricsSubscriptionManager _manager;

    public MetricsHub(MetricsSubscriptionManager manager)
    {
        _manager = manager;
    }

    public async Task SubscribeToMachine(string hostname)
    {
        _manager.AddSubscriber(hostname);
        await Groups.AddToGroupAsync(Context.ConnectionId, $"metrics-{hostname}");
    }

    public async Task UnsubscribeFromMachine(string hostname)
    {
        _manager.RemoveSubscriber(hostname);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"metrics-{hostname}");
    }
}
