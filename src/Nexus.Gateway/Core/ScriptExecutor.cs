using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Net;
using Microsoft.Extensions.Logging;

namespace Nexus.Gateway.Core;

public class ScriptExecutor
{
    private readonly WinRmConnectionPool _pool;
    private readonly ILogger<ScriptExecutor> _logger;

    public ScriptExecutor(WinRmConnectionPool pool, ILogger<ScriptExecutor> logger)
    {
        _pool = pool;
        _logger = logger;
    }

    public async Task<ScriptResult> ExecutePowerShellAsync(
        string script,
        string targetHostname,
        NetworkCredential? credential = null,
        bool useSSL = false)
    {
        return await Task.Run(() =>
        {
            try
            {
                var uri = new Uri($"http{(useSSL ? "s" : "")}://{targetHostname}:{(useSSL ? 5986 : 5985)}/wsman");
                var connectionInfo = credential != null
                    ? new WSManConnectionInfo(uri, "http://schemas.microsoft.com/powershell/Microsoft.PowerShell",
                        new PSCredential(credential.UserName, credential.SecurePassword))
                    : new WSManConnectionInfo(uri);

                connectionInfo.OperationTimeout = 30000;
                connectionInfo.OpenTimeout = 10000;
                connectionInfo.AuthenticationMechanism = AuthenticationMechanism.Negotiate;

                using var runspace = RunspaceFactory.CreateRunspace(connectionInfo);
                runspace.Open();

                using var ps = PowerShell.Create();
                ps.Runspace = runspace;
                ps.AddScript(script);

                var results = ps.Invoke();
                var errors = ps.Streams.Error.ToList();

                if (errors.Any())
                {
                    return new ScriptResult
                    {
                        Success = false,
                        Output = string.Join("\n", results.Select(r => r?.ToString() ?? "")),
                        Error = string.Join("\n", errors.Select(e => e.ToString())),
                        Hostname = targetHostname
                    };
                }

                return new ScriptResult
                {
                    Success = true,
                    Output = string.Join("\n", results.Select(r => r?.ToString() ?? "")),
                    RawObjects = results.Select(r => r?.BaseObject).ToList(),
                    Hostname = targetHostname
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Script execution failed on {Hostname}", targetHostname);
                return new ScriptResult
                {
                    Success = false,
                    Error = ex.Message,
                    Hostname = targetHostname
                };
            }
        });
    }

    public async Task<List<ScriptResult>> ExecuteParallelAsync(
        string script,
        IEnumerable<string> hostnames,
        NetworkCredential? credential = null)
    {
        var tasks = hostnames.Select(h => ExecutePowerShellAsync(script, h, credential));
        return (await Task.WhenAll(tasks)).ToList();
    }
}

public class ScriptResult
{
    public bool Success { get; set; }
    public string Output { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public string Hostname { get; set; } = string.Empty;
    public List<object?> RawObjects { get; set; } = new();
}
