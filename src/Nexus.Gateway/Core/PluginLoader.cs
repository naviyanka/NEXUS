using System.Text.Json;
using Microsoft.Extensions.Logging;
using Nexus.Gateway.Models;

namespace Nexus.Gateway.Core;

public class PluginLoader
{
    private readonly ILogger<PluginLoader> _logger;
    private readonly string _pluginsDirectory;
    private readonly List<PluginManifest> _loadedPlugins = new();

    public PluginLoader(ILogger<PluginLoader> logger)
    {
        _logger = logger;
        _pluginsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "plugins");
    }

    public void LoadPlugins()
    {
        if (!Directory.Exists(_pluginsDirectory))
        {
            Directory.CreateDirectory(_pluginsDirectory);
            _logger.LogInformation("Created plugins directory at {Path}", _pluginsDirectory);
            return;
        }

        foreach (var dir in Directory.GetDirectories(_pluginsDirectory))
        {
            var manifestPath = Path.Combine(dir, "plugin.json");
            if (File.Exists(manifestPath))
            {
                try
                {
                    var json = File.ReadAllText(manifestPath);
                    var manifest = JsonSerializer.Deserialize<PluginManifest>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (manifest != null)
                    {
                        _loadedPlugins.Add(manifest);
                        _logger.LogInformation("Loaded plugin: {PluginName} (v{Version})", manifest.Name, manifest.Version);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to load plugin manifest at {Path}", manifestPath);
                }
            }
        }
    }

    public IEnumerable<PluginManifest> GetLoadedPlugins() => _loadedPlugins;
}
