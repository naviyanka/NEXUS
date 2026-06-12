using System.Collections.Concurrent;

namespace Nexus.Gateway.Core;

/// <summary>
/// Maintains active WinRM connections to target machines to reduce connection overhead.
/// </summary>
public class WinRmConnectionPool
{
    private readonly ConcurrentDictionary<string, object> _connections = new();

    public object GetConnection(string hostname)
    {
        // Placeholder for WSManConnectionInfo pooling
        return _connections.GetOrAdd(hostname, _ => new object());
    }

    public void ReleaseConnection(string hostname)
    {
        _connections.TryRemove(hostname, out _);
    }
}
