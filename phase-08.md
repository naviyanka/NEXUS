# Phase 8 — Credentials Manager (DPAPI Vault)  
  
> **Read NEXUS-MASTER.md first** before working on this phase.  
  
---  
  
## Goal  
Build the credentials vault using Windows DPAPI (Data Protection API) for encrypting stored credentials at rest. NEXUS stores named credential profiles (e.g., "domain-admin", "sql-sa") that plugins use to connect to machines. Credentials are encrypted per-machine — only the NEXUS Windows Service account can decrypt them.  
  
---  
  
## Context  
When NEXUS runs a script on a remote machine, it needs credentials. Instead of hardcoding credentials in `machines.yaml`, NEXUS maintains a named credential store. Each machine references a credential ID (e.g., `credential_id: domain-admin`). The actual username/password is stored encrypted using Windows DPAPI. The metadata (name, username hint, type) is in SQLite; the encrypted payload is in a separate `.vault` file.  
  
---  
  
## Scope  
**In scope:**  
- `CredentialVault.cs` — DPAPI encrypt/decrypt wrapper  
- `ICredentialService` — CRUD for credential profiles  
- Credential metadata in SQLite (Phase 5 schema)  
- Encrypted payload in `data/credentials/` directory  
- API: `GET /api/credentials`, `POST /api/credentials`, `DELETE /api/credentials/{id}`  
- API: `POST /api/credentials/test` — test a credential against a machine  
- Integration with WinRmClient (Phase 2) and ScriptExecutor (Phase 3)  
  
**Out of scope:**  
- UI for managing credentials (Phase 40)  
- Per-plugin credential scoping (future)  
  
---  
  
## Credential Encryption Model — Hybrid DPAPI + Passphrase

NEXUS uses a two-layer encryption model to ensure portability:

```
Layer 1 (Base):      DPAPI — provides OS-level encryption at rest
Layer 2 (Portable):  AES-256-GCM keyed from user-defined Master Passphrase
Final ciphertext:    AES-256(DPAPI(plaintext), DeriveKey(masterPassphrase))
```

### Implementation

```csharp
public class CredentialVaultService
{
    // Encrypt: DPAPI → then AES-256-GCM with passphrase-derived key
    public byte[] Encrypt(string plaintext, string masterPassphrase)
    {
        var dpapiBytes = ProtectedData.Protect(
            Encoding.UTF8.GetBytes(plaintext),
            null,
            DataProtectionScope.LocalMachine);

        var key = DeriveKey(masterPassphrase);   // PBKDF2, 100k iterations, SHA-256
        return AesGcmEncrypt(dpapiBytes, key);
    }

    // Export: produces vault.export.json encrypted with passphrase ONLY (DPAPI-free)
    public VaultExport ExportVault(string masterPassphrase)
    {
        // Re-encrypt all entries with passphrase only (strips DPAPI layer)
        // Allows import on a different machine
    }

    // Rotate: re-encrypt all entries under new passphrase
    public void RotateMasterKey(string oldPassphrase, string newPassphrase) { }
}
```

### Vault Export Format (`vault.export.json`)

```json
{
  "version": "1.0",
  "exportedAt": "ISO-8601",
  "algorithm": "AES-256-GCM",
  "kdf": "PBKDF2-SHA256-100000",
  "salt": "<base64>",
  "entries": [
    {
      "id": "<guid>",
      "label": "DOMAIN\\svcAccount",
      "ciphertext": "<base64>",
      "nonce": "<base64>"
    }
  ]
}
```

### Enforcement Rules

- Master passphrase is NEVER stored on disk — entered at NEXUS startup or unlock
- DPAPI layer is local optimization only — vault must be fully restorable from export
- Key rotation MUST re-encrypt all entries atomically (transaction pattern)
- **Sub-phase required:** `Phase-08.1_VaultBackupSystem.md`  
  
## Credentials API Controller  
```csharp  
[ApiController][Route("api/credentials")]  
public class CredentialsController : ControllerBase  
{  
    [HttpGet]              // List all credential metadata (NO passwords returned ever)  
    [HttpPost]             // Add new credential (encrypt + store metadata)  
    [HttpDelete("{id}")]   // Delete credential + vault file  
    [HttpPost("{id}/test")] // Test credential against a machine  
    [HttpPut("{id}")]      // Update credential  
}  
```  
  
## Credential Models  
```csharp  
public class CredentialProfile  
{  
    public string Id { get; set; }          // "domain-admin"  
    public string DisplayName { get; set; } // "Domain Administrator"  
    public string Username { get; set; }    // "DOMAIN\administrator" (shown in UI)  
    public string? Domain { get; set; }  
    public string Type { get; set; }        // "domain" | "local"  
    public DateTime CreatedAt { get; set; }  
    public DateTime? LastUsed { get; set; }  
    // Password is NEVER returned in API responses  
}  
  
public class CreateCredentialRequest  
{  
    public string Id { get; set; }  
    public string DisplayName { get; set; }  
    public string Domain { get; set; }  
    public string Username { get; set; }  
    public string Password { get; set; }  // Only accepted on create/update  
    public string Type { get; set; }  
}  
```  
  
---  
  
## API Endpoints  
  
| Method | Endpoint | Notes |  
|--------|----------|-------|  
| GET | `/api/credentials` | List profiles (no passwords) |  
| POST | `/api/credentials` | Create with password |  
| PUT | `/api/credentials/{id}` | Update (password optional) |  
| DELETE | `/api/credentials/{id}` | Remove vault file + metadata |  
| POST | `/api/credentials/{id}/test` | Test against machine |  
  
---  
  
## Files to Create/Modify  
  
| File | Action |  
|------|--------|  
| `src/Nexus.Gateway/Core/CredentialVault.cs` | Create |  
| `src/Nexus.Gateway/Core/CredentialService.cs` | Create |  
| `src/Nexus.Gateway/Controllers/CredentialsController.cs` | Create |  
| `src/Nexus.Gateway/Program.cs` | Modify (DI registration) |  
  
---  
  
## Test Criteria  
- [ ] `POST /api/credentials` stores encrypted file in `data/credentials/`  
- [ ] `GET /api/credentials` returns profile list with NO password fields  
- [ ] Encrypted vault file is unreadable without DPAPI key (binary encrypted data)  
- [ ] `POST /api/credentials/domain-admin/test` with real DC returns success  
- [ ] `DELETE /api/credentials/domain-admin` removes vault file and DB record  
- [ ] WinRmClient resolves credential by ID from vault when connecting  
  
---  
  
## Sub-Phase Breakdown (if needed)  
- **8-0:** DPAPI vault wrapper (store/retrieve/delete)  
- **8-1:** CredentialService + SQLite metadata  
- **8-2:** CredentialsController + API endpoints  
- **8-3:** Integration with WinRmClient + ScriptExecutor  
  
---  
  
## Notes for Coding Agent  
- DPAPI `DataProtectionScope.LocalMachine` provides base OS-level protection
- The Hybrid encryption approach is mandatory to allow for Vault export and import across machines.
- NEVER log credential values, even in debug mode  
- The `credentials.yaml` in `config/` stores only credential IDs for machine mapping, NOT passwords  
- `data/credentials/` directory must be excluded from backups (or backups must be encrypted)  
- Add `data/credentials/` to `.gitignore`