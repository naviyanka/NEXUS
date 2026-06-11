# Phase 08.1 — Vault Backup & Export System

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Implement a secure export, import, and backup mechanism for the Credential Vault. This resolves the limitation of pure DPAPI (which is bound to a single machine/user context) by allowing administrators to export a portable, encrypted vault backup and import it onto a new NEXUS gateway.

---

## Scope
**In scope:**
- Backend: `CredentialVaultService` updates for portable export/import
- UI: Export Vault modal with Passphrase entry
- UI: Import Vault modal with file upload and Passphrase verification
- Logic: Key rotation flow (atomic re-encryption)
- Data: JSON Schema for `vault.export.json`
- Verification: Checksum validation on backups

---

## Prerequisites
- Phase 08 (Credential Vault)
- Phase 12 (UI/Renderer)

---

## Detailed Tasks

### 1. Update CredentialVaultService

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

### 2. Export File Schema (`vault.export.json`)

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

### 3. Key Rotation & Backup Verification

Implement an endpoint `POST /api/vault/rotate` that takes `oldPassphrase` and `newPassphrase`. It must atomically re-encrypt every stored credential.
Implement a checksum mechanism (e.g. HMAC of the vault export) to verify integrity upon import before applying changes.

---

## Test Criteria
- [ ] Exporting the vault produces a well-formed JSON file.
- [ ] Changing the master passphrase successfully updates all DPAPI+AES entries in SQLite without losing access to passwords.
- [ ] Importing `vault.export.json` on a simulated fresh instance successfully registers the credentials.
