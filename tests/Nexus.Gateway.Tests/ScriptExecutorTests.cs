using Nexus.Gateway.Core;

namespace Nexus.Gateway.Tests;

public class ScriptExecutorTests
{
    [Fact]
    public async Task ExecutePowerShellAsync_ReturnsSimulatedSuccess()
    {
        var executor = new ScriptExecutor();
        var result = await executor.ExecutePowerShellAsync("Get-Process", "localhost");

        Assert.Contains("Success", result);
        Assert.Contains("localhost", result);
    }
}
