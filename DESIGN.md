# Notebook Sync & Storage Design

## 1. Core Concepts

- **Notebook** = collection of notes (markdown) + images.
- **Files stored encrypted** in remote object storage.
- **Client does all crypto**. Server is dumb storage.
- **Zero-knowledge**: browsing remote storage reveals only UUIDs and encrypted data, no readable metadata.
- **Multi-notebook support**: Users can have multiple notebooks, each independently encrypted.

## 2. User-Facing Terminology

The following technical terms are presented to users with different names:

- **Notebook** → **Codex**
- **Note** → **Rune**
- **Image** → **Sigil**

## 3. File Types in Remote Storage

### Root Level (per user):

- **meta.json** _(unencrypted)_: contains KDF parameters + encrypted MEK for decrypting the map.
- **map.json.enc** _(encrypted with MEK)_: lists all notebooks (UUID + title only).

### Notebook Level (per notebook):

- **meta.json** _(unencrypted)_: contains KDF parameters + encrypted FEK.
- **manifest.json.enc** _(encrypted with FEK)_: maps blob UUIDs → titles, types, metadata.
- **blobs/**: every note/image stored as `<uuid>.enc`.
- **search.db.enc** _(optional)_: encrypted SQLite database for FTS indexing.

## 4. Cryptography

### Three-Tier Key System:

- **MEK** (Map Encryption Key): random 256-bit key, encrypted by a key derived from lookup_key.
  - Used to decrypt `map.json.enc` (notebook list).
  - The lookup_key is used with PBKDF2-SHA256 to derive a key that decrypts `encrypted_mek`.
  - Fast derivation since lookup_key already has good entropy.

- **KEK** (Key Encryption Key): derived from lookup_key using strong KDF (Argon2id).
  - Used to decrypt `encrypted_fek` in notebook's `meta.json`.
  - Strong protection even if lookup_key has moderate entropy.
  - Each notebook has independent KEK (different salt).

- **FEK** (File Encryption Key): random 256-bit key, encrypted by KEK.
  - Used to encrypt/decrypt notebook content (manifest, blobs, search index).
  - Each notebook has independent FEK for isolation.

- **Cipher**: AES-256-GCM for all encryption operations.

### Key Derivation Flow:

```
lookup_key + root_salt → [PBKDF2] → derived_key → decrypt encrypted_mek → MEK → decrypt map.json.enc

lookup_key + notebook_salt → [Argon2id] → KEK → decrypt encrypted_fek → FEK

FEK → decrypt manifest.json.enc, blobs, search.db.enc
```

**Note**: The system architecture supports using the same lookup_key for all notebooks (user convenience) or different keys per notebook (future flexibility). Each derivation is independent due to unique salts and KDF parameters.

### Root meta.json structure:

```json
{
  "version": 1,
  "kdf": {
    "algorithm": "pbkdf2-sha256",
    "salt": "base64-encoded-salt",
    "iterations": 10000
  },
  "encrypted_mek": {
    "ciphertext": "base64-encoded-ciphertext",
    "nonce": "base64-encoded-nonce",
    "tag": "base64-encoded-tag"
  },
  "encryption": {
    "cipher": "aes-256-gcm",
    "tag_length": 16
  }
}
```

### Root map.json.enc (decrypted form):

```json
{
  "version": 1,
  "last_updated": "2025-11-11T12:00:00Z",
  "entries": [
    {
      "uuid": "4fbb1d4e-9df3-4b59-b492-91aef9d6a731",
      "title": "My Personal Notes"
    },
    {
      "uuid": "7a3c9e2f-8d1b-4c6a-9f5e-2b7d8c4a1e6f",
      "title": "Work Projects"
    }
  ]
}
```

### Notebook meta.json structure:

```json
{
  "version": 1,
  "kdf": {
    "algorithm": "argon2id",
    "salt": "base64-encoded-salt",
    "iterations": 3,
    "memory": 65536,
    "parallelism": 4
  },
  "encrypted_fek": {
    "ciphertext": "base64-encoded-ciphertext",
    "nonce": "base64-encoded-nonce",
    "tag": "base64-encoded-tag"
  },
  "encryption": {
    "cipher": "aes-256-gcm",
    "tag_length": 16
  }
}
```

### Notebook manifest.json.enc (decrypted form):

```json
{
  "version": 1,
  "notebook_id": "4fbb1d4e-9df3-4b59-b492-91aef9d6a731",
  "last_updated": "2025-11-11T12:05:00Z",
  "entries": [
    {
      "uuid": "7e6b2f34-5027-4f79-8a11-9d4b11322d3c",
      "type": "note",
      "title": "Meeting notes",
      "version": 2,
      "last_updated": "2025-11-11T12:02:00Z",
      "hash": "sha256-98af...d0c",
      "size": 2456
    },
    {
      "uuid": "83a7f56d-9c2e-4a19-b78e-56d6e8de32d5",
      "type": "image",
      "title": "Architecture diagram.png",
      "version": 1,
      "last_updated": "2025-11-10T18:45:00Z",
      "hash": "sha256-bf10...a93",
      "size": 158432
    }
  ]
}
```

## 5. Filenames & IDs

- **Lookup Hash**: HMAC-SHA256(email, lookup_key) → used as root storage directory.
- **Notebook ID**: random UUID v4.
- **Blob IDs**: random UUID v4.
- **Storage paths**:

  ```
  <lookup_hash>/meta.json
  <lookup_hash>/map.json.enc
  <lookup_hash>/<notebook_id>/meta.json
  <lookup_hash>/<notebook_id>/manifest.json.enc
  <lookup_hash>/<notebook_id>/blobs/<uuid>.enc
  <lookup_hash>/<notebook_id>/search.db.enc (optional)
  ```

## 6. Client Workflow

### First-time setup (new device):

1. User enters **email + lookup_key** (once).
2. Compute `lookup_hash = HMAC-SHA256(email, lookup_key)`.
3. Fetch `/<lookup_hash>/meta.json` (root meta).
4. Derive key using `PBKDF2(lookup_key, root_salt, 10k iterations)`, decrypt `encrypted_mek` to get MEK.
5. Fetch and decrypt `/<lookup_hash>/map.json.enc` with MEK.
6. Display notebook selection UI with titles from map.
7. User selects a notebook (e.g., "My Personal Notes").
8. Fetch `/<lookup_hash>/<selected_uuid>/meta.json` (notebook meta).
9. Derive `KEK = Argon2id(lookup_key, notebook_salt, strong params)`.
10. Decrypt `encrypted_fek` with KEK to get FEK.
11. Fetch and decrypt `manifest.json.enc` with FEK.
12. Fetch and decrypt needed blobs with FEK.
13. User can now read/edit notes.

**Note**: Steps 8-13 can be performed for multiple notebooks in parallel if needed.

### Caching:

- **Root meta.json** cached in memory for session.
- **Map.json.enc** cached in OPFS (encrypted).
- **Encrypted blobs** stored in OPFS (so persistence doesn't leak plaintext).
- **Decrypted blobs** only in memory.
- **Local search index** in OPFS, encrypted with FEK.

### Periodic sync:

- Client periodically fetches `map.json.enc` to check for new/renamed notebooks.
- For each open notebook, fetch `manifest.json.enc`.
- Compare versions/timestamps with local OPFS.
- Download missing/updated blobs.
- Upload new/modified blobs and updated manifest.

## 7. Conflict Handling

- **Strategy**: Last-Write-Wins (LWW).
- Each entry has `last_updated` timestamp.
- When manifests differ:
  - If remote > local → overwrite local.
  - If local > remote → upload to server (bump manifest).

- This avoids manual merge complexity for now.

### Notebook Title Synchronization:

- Notebook titles are stored in **two places**:
  1. `map.json.enc` (for quick listing without decrypting notebooks).
  2. `manifest.json.enc` (source of truth within each notebook).
- When a notebook title is changed:
  1. Update `notebook_id` field in the notebook's `manifest.json.enc`.
  2. Upload updated manifest with new `last_updated` timestamp.
  3. Update corresponding entry in `map.json.enc`.
  4. Upload updated map with new `last_updated` timestamp.

- During sync, if map and manifest titles diverge, manifest title is authoritative.

## 8. OPFS Structure (on client)

```
opfs/
  <lookup_hash>/
    map.json.enc          # cached notebook list
    <notebook_id>/
      blobs/
        <uuid>.enc        # encrypted blob
      manifest.json.enc   # latest manifest
      search.db.enc       # local FTS index, encrypted with FEK
```

## 9. Search (FTS)

- Client uses **SQLite WASM** to maintain a search index (`search.db.enc`).
- Contains decrypted content of notes (plaintext only while running).
- DB encrypted with FEK when stored in OPFS.
- Search queries run locally, results map back to blob UUIDs.
- Each notebook has its own independent search index.

## 10. Server Responsibilities

- **Path derivation**: Compute `lookup_hash = HMAC(email, lookup_key)` to determine storage root path.
- **Return root meta.json** when requested (`/<lookup_hash>/meta.json`).
- **Return map.json.enc** when requested (`/<lookup_hash>/map.json.enc`).
- **Return notebook meta.json** when requested (`/<lookup_hash>/<notebook_id>/meta.json`).
- **Return manifest.json.enc** when requested for specific notebooks.
- **Serve blobs** (`<uuid>.enc`) on demand.
- **Accept uploads**: new or updated blobs, manifests, and map updates.

**Zero-Knowledge Guarantee**:

- Server never sees email (only lookup_hash).
- Server never sees lookup_key, passphrases, or any encryption keys.
- Server never sees decrypted data (MEK, FEK, notebook titles, note content).
- Server only handles encrypted blobs and metadata.
