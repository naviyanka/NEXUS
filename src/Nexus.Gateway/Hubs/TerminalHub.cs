using System.Collections.Concurrent;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Nexus.Gateway.Hubs;

[Authorize]
public class TerminalHub : Hub
{
    private static readonly ConcurrentDictionary<string, Runspace> _runspaces = new();
    private readonly ILogger<TerminalHub> _logger;

    public TerminalHub(ILogger<TerminalHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var hostname = httpContext?.Request.Query["hostname"].ToString() ?? "localhost";

        try
        {
            var uri = new Uri($"http://{hostname}:5985/wsman");
            var connectionInfo = new WSManConnectionInfo(uri);
            connectionInfo.AuthenticationMechanism = AuthenticationMechanism.Negotiate;

            var runspace = RunspaceFactory.CreateRunspace(connectionInfo);
            runspace.Open();

            _runspaces.TryAdd(Context.ConnectionId, runspace);
            await Clients.Caller.SendAsync("TerminalConnected", $"Connected to {hostname}\r\n");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to open runspace for {Hostname}", hostname);
            await Clients.Caller.SendAsync("TerminalError", $"Connection failed: {ex.Message}\r\n");
        }

        await base.OnConnectedAsync();
    }

    public async Task SendInput(string input)
    {
        if (_runspaces.TryGetValue(Context.ConnectionId, out var runspace))
        {
            try
            {
                using var ps = PowerShell.Create();
                ps.Runspace = runspace;
                ps.AddScript(input);

                var results = ps.Invoke();
                var errors = ps.Streams.Error.ToList();

                foreach (var result in results)
                {
                    if (result != null)
                    {
                        await Clients.Caller.SendAsync("TerminalOutput", $"{result}\r\n");
                    }
                }

                foreach (var error in errors)
                {
                    await Clients.Caller.SendAsync("TerminalError", $"ERROR: {error}\r\n");
                }
            }
            catch (Exception ex)
            {
                await Clients.Caller.SendAsync("TerminalError", $"ERROR: {ex.Message}\r\n");
            }
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_runspaces.TryRemove(Context.ConnectionId, out var runspace))
        {
            try
            {
                runspace.Close();
                runspace.Dispose();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing runspace for connection {ConnectionId}", Context.ConnectionId);
            }
        }

        await base.OnDisconnectedAsync(exception);
    }
}
