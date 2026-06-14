using System.Collections.Concurrent;

namespace Nexus.Gateway.Core;

// Tracks which machines currently have active subscribers.
public class MetricsSubscriptionManager
{
    private readonly ConcurrentDictionary<string, int> _machineSubscribers = new();

    public void AddSubscriber(string hostname)
    {
        _machineSubscribers.AddOrUpdate(hostname, 1, (_, count) => count + 1);
    }

    public void RemoveSubscriber(string hostname)
    {
        _machineSubscribers.AddOrUpdate(hostname, 0, (_, count) => Math.Max(0, count - 1));
    }

    public IEnumerable<string> GetActiveMachines()
    {
        return _machineSubscribers.Where(kv => kv.Value > 0).Select(kv => kv.Key).ToList();
    }
}
