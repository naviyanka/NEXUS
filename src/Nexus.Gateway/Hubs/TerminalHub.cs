using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;

namespace Nexus.Gateway.Hubs;

// We require authorization to connect to the terminal hub
[Authorize]
public class TerminalHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        await Clients.Caller.SendAsync("TerminalConnected", "Welcome to NEXUS Remote Terminal\r\n");
        await base.OnConnectedAsync();
    }

    public async Task SendInput(string input)
    {
        // Placeholder: here we would route the input to the actual PowerShell runspace
        // bound to this connection ID, then read the output and stream it back.
        await Clients.Caller.SendAsync("TerminalOutput", $"Echo: {input}\r\n");
    }
}
