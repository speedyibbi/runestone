
---

# Notebook Sync & Storage Design

## 1. Core Concepts

* **Notebook** = collection of notes (markdown) + images.
* **Files stored encrypted** in S3.
* **Client does all crypto**. Server (Lambda + S3) is dumb storage.
* **Zero-knowledge**: browsing S3 reveals only UUIDs, no readable metadata.

## 2. File Types in S3

* **meta.json** *(unencrypted)*: contains KDF parameters + encrypted FEK.
* **manifest.json.enc** *(encrypted with FEK)*: maps UUIDs → titles, types, metadata.
* **blobs/**: every note/image stored as `<uuid>.enc`.
* **search.db.enc** *(optional)*: encrypted SQLite database for FTS indexing.

## 3. Cryptography

* **KEK**: derived from passphrase using KDF (Argon2id).
* **FEK**: random 256-bit key, encrypted by KEK and stored in `meta.json`.
* **Blobs, manifest, search index**: all encrypted with FEK.
* **Cipher**: AES-256-GCM (or ChaCha20-Poly1305).

### meta.json structure:

```json
{
  "version": 1,
  "user_id": "alice@example.com",
  "kdf": {
    "algorithm": "argon2id",
    "salt": "t41GkZKzHcoWjJf8+TbA==",
    "iterations": 3,
    "memory": 65536,
    "parallelism": 4
  },
  "encrypted_fek": {
    "ciphertext": "zvF8y7XvN9YttrD2vV9m...==",
    "nonce": "kO99XUzPMQ7j6yhj",
    "tag": "9Jb9hTPhkMNG6zM="
  },
  "encryption": {
    "cipher": "aes-256-gcm",
    "tag_length": 16
  }
}
```

### manifest.json.enc (decrypted form):

```json
{
  "manifest_version": 5,
  "last_updated": "2025-09-14T12:05:00Z",
  "notebook_id": "4fbb1d4e-9df3-4b59-b492-91aef9d6a731",
  "entries": [
    {
      "uuid": "7e6b2f34-5027-4f79-8a11-9d4b11322d3c",
      "type": "note",
      "title": "Meeting notes",
      "version": 2,
      "last_modified": "2025-09-14T12:02:00Z",
      "hash": "sha256-98af...d0c",
      "size": 2456
    },
    {
      "uuid": "83a7f56d-9c2e-4a19-b78e-56d6e8de32d5",
      "type": "image",
      "title": "Architecture diagram.png",
      "version": 1,
      "last_modified": "2025-09-13T18:45:00Z",
      "hash": "sha256-bf10...a93",
      "size": 158432
    }
  ]
}
```

## 4. Filenames & IDs

* **Notebook ID**: random UUID v4.
* **Blob IDs**: random UUID v4.
* **S3 paths**:

  ```
  notebooks/<notebook_id>/meta.json
  notebooks/<notebook_id>/manifest.json.enc
  notebooks/<notebook_id>/blobs/<uuid>.enc
  notebooks/<notebook_id>/search.db.enc (optional)
  ```

## 5. Client Workflow

### First-time fetch (new device):

1. User enters email + lookup key → Lambda returns `meta.json`.
2. User enters passphrase → derive KEK → decrypt FEK.
3. Use FEK → decrypt `manifest.json.enc`.
4. Manifest lists UUIDs → client fetches only needed blobs.
5. Blobs decrypted in memory before use.

### Caching:

* **Encrypted blobs** stored in OPFS (so persistence doesn’t leak plaintext).
* **Decrypted blobs** only in memory.
* **Local index DB** in OPFS, encrypted with FEK, used for search.

### Periodic sync:

* Client periodically fetches `manifest.json.enc`.
* Compare versions/timestamps with local OPFS.
* Download missing/updated blobs.
* Upload new/modified blobs.

## 6. Conflict Handling

* **Strategy**: Last-Write-Wins (LWW).
* Each entry has `last_modified` timestamp.
* When manifests differ:

  * If remote > local → overwrite local.
  * If local > remote → upload to server (bump manifest).
* This avoids manual merge complexity for now.

## 7. OPFS Structure (on client)

```
opfs/
  notebooks/
    <notebook_id>/
      blobs/
        <uuid>.enc         # encrypted blob
      manifest.json.enc     # latest manifest
      search.db.enc         # local FTS index, encrypted
```

## 8. Search (FTS)

* Client uses **SQLite WASM** to maintain a search index (`search.db.enc`).
* Contains decrypted content of notes (plaintext only while running).
* DB encrypted with FEK when stored in OPFS.
* Search queries run locally, results map back to blob UUIDs.

## 9. Server (Lambda) Responsibilities

* Auth (email + lookup key → notebook bucket path).
* Return **meta.json** when requested.
* Return **manifest.json.enc** when requested.
* Serve blobs (`<uuid>.enc`) on demand.
* Accept uploads (new or updated blobs, new manifest).
* **Never sees passphrases, FEK, or decrypted data.**
