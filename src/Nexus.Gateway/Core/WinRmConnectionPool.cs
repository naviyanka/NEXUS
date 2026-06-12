using System.Collections.Concurrent;

namespace Nexus.Gateway.Core;

public class WinRmConnectionPool
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();
    private readonly ConcurrentDictionary<string, MachineConnectionInfo> _registry = new();

    public void Register(string hostname, string? username = null, string? password = null)
    {
        _registry[hostname] = new MachineConnectionInfo
        {
            Hostname = hostname,
            Username = username,
            Password = password,
            LastSeen = DateTime.UtcNow
        };
    }

    public SemaphoreSlim GetLock(string hostname)
        => _locks.GetOrAdd(hostname, _ => new SemaphoreSlim(3, 3)); // max 3 concurrent sessions per host

    public MachineConnectionInfo? GetInfo(string hostname)
        => _registry.TryGetValue(hostname, out var info) ? info : null;

    public bool IsRegistered(string hostname) => _registry.ContainsKey(hostname);

    public IEnumerable<string> GetRegisteredHosts() => _registry.Keys;
}

public class MachineConnectionInfo
{
    public string Hostname { get; set; } = string.Empty;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public DateTime LastSeen { get; set; }
    public bool IsReachable { get; set; }
}
