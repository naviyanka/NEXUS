using System.Security.Cryptography;
using System.Text;

namespace Nexus.Gateway.Core;

/// <summary>
/// Handles credentials encrypted at rest using Windows DPAPI.
/// Because this uses DPAPI, the data is encrypted based on the Windows Service account running Nexus.
/// </summary>
public class VaultService
{
    private readonly string _vaultPath;

    public VaultService()
    {
        // For phase 2 testing, putting it in current dir
        _vaultPath = Path.Combine(Directory.GetCurrentDirectory(), "nexus_vault.dat");
    }

    public void StoreSecret(string key, string secret)
    {
        var data = Encoding.UTF8.GetBytes(secret);
        // Protect the payload. Due to Windows Service scope, we use CurrentUser scope
        // Assuming the service runs as a specific domain user
        var encrypted = ProtectedData.Protect(data, null, DataProtectionScope.CurrentUser);

        var base64 = Convert.ToBase64String(encrypted);
        // In real impl, store in SQLite. For phase 2 stub, we mock it.
        File.WriteAllText(_vaultPath, base64);
    }

    public string RetrieveSecret(string key)
    {
        if (!File.Exists(_vaultPath)) return string.Empty;

        var base64 = File.ReadAllText(_vaultPath);
        var encrypted = Convert.FromBase64String(base64);

        try
        {
            var decrypted = ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser);
            return Encoding.UTF8.GetString(decrypted);
        }
        catch (CryptographicException)
        {
            // Fails if read by a different user than the one who wrote it
            return string.Empty;
        }
    }
}
