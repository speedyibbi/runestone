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

## 4. Cryptography

### Three-Tier Key System:

- **MKEK** (Map Key Encryption Key): derived from lookup_hash using PBKDF2-SHA256.
  - Used to decrypt `encrypted_mek` in root `meta.json`.
  - Fast derivation since lookup_hash already has good entropy.

- **MEK** (Map Encryption Key): random 256-bit key, stored encrypted in root `meta.json`.
  - Decrypted using MKEK.
  - Used to decrypt `map.json.enc` (notebook list).

- **FKEK** (File Key Encryption Key): derived from lookup_hash using strong KDF (Argon2id).
  - Used to decrypt `encrypted_fek` in notebook's `meta.json`.
  - Strong protection even if lookup_key has moderate entropy.
  - Each notebook has independent FKEK (different salt).

- **FEK** (File Encryption Key): random 256-bit key, stored encrypted in notebook's `meta.json`.
  - Decrypted using FKEK.
  - Used to encrypt/decrypt notebook content (manifest, blobs).
  - Each notebook has independent FEK for isolation.

- **Cipher**: AES-256-GCM for all encryption operations.

### Key Derivation Flow:

```
passphrase → [SHA256] → lookup_hash

lookup_hash + root_salt → [PBKDF2] → MKEK → decrypt encrypted_mek → MEK → decrypt map.json.enc

lookup_hash + notebook_salt → [Argon2id] → FKEK → decrypt encrypted_fek → FEK

FEK → decrypt manifest.json.enc, blobs
```

**Note**: The lookup_hash is computed once from the passphrase using SHA256, then used for all key derivations. Each notebook's encryption is independent due to unique salts and KDF parameters.

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
  "notebook_title": "My Personal Notes",
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

- **Lookup Hash**: SHA256(passphrase) → used as root storage directory.
- **Notebook ID**: random UUID v4.
- **Blob IDs**: random UUID v4.
- **Storage paths**:

  ```
  <lookup_hash>/meta.json
  <lookup_hash>/map.json.enc
  <lookup_hash>/<notebook_id>/meta.json
  <lookup_hash>/<notebook_id>/manifest.json.enc
  <lookup_hash>/<notebook_id>/blobs/<uuid>.enc
  ```

## 6. Client Workflow

### First-time setup (new device):

1. User enters **passphrase** (once).
2. Compute `lookup_hash = SHA256(passphrase)`.
3. Fetch `/<lookup_hash>/meta.json` (root meta).
4. Derive `MKEK = PBKDF2(lookup_hash, root_salt, 10k iterations)`.
5. Decrypt `encrypted_mek` with MKEK to get MEK.
6. Fetch and decrypt `/<lookup_hash>/map.json.enc` with MEK.
7. Display notebook selection UI with titles from map.
8. User selects a notebook (e.g., "My Personal Notes").
9. Fetch `/<lookup_hash>/<selected_uuid>/meta.json` (notebook meta).
10. Derive `FKEK = Argon2id(lookup_hash, notebook_salt, strong params)`.
11. Decrypt `encrypted_fek` with FKEK to get FEK.
12. Fetch and decrypt `manifest.json.enc` with FEK.
13. Fetch and decrypt needed blobs with FEK.
14. User can now read/edit notes.

**Note**: Steps 9-14 can be performed for multiple notebooks in parallel if needed.

### Caching:

- **Root meta.json** cached in memory for session.
- **Map.json.enc** cached in OPFS (encrypted).
- **Encrypted blobs** stored in OPFS (so persistence doesn't leak plaintext).
- **Decrypted blobs** only in memory.
- **Search index** only in memory, rebuilt in background when notebook opens.

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
```

## 9. Search (FTS)

- Client uses **SQLite WASM** to maintain a search index in memory only.
- Contains decrypted content of notes (plaintext only while running).
- Index is rebuilt in the background every time a notebook is opened.
- Search index is never persisted to disk (OPFS or remote storage).
- Search queries run locally, results map back to blob UUIDs.
- Each notebook has its own independent search index.

## 10. Server Responsibilities

- **Path derivation**: Compute `lookup_hash = SHA256(passphrase)` to determine storage root path.
- **Return root meta.json** when requested (`/<lookup_hash>/meta.json`).
- **Return map.json.enc** when requested (`/<lookup_hash>/map.json.enc`).
- **Return notebook meta.json** when requested (`/<lookup_hash>/<notebook_id>/meta.json`).
- **Return manifest.json.enc** when requested for specific notebooks.
- **Serve blobs** (`<uuid>.enc`) on demand.
- **Accept uploads**: new or updated blobs, manifests, and map updates.

**Zero-Knowledge Guarantee**:

- Server never sees the passphrase (only lookup_hash derived from it).
- Server never sees any encryption keys (MKEK, MEK, FKEK, FEK).
- Server never sees decrypted data (notebook titles, note content, metadata).
- Server only handles encrypted blobs and metadata.

## 11. Feature Flags

This section documents all configurable feature flags for controlling system behavior, security parameters, performance characteristics, and experimental features.

### Core Feature Flags

#### **FEATURE_MULTI_NOTEBOOK**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable multiple notebook (codex) support per user.
- **Impact**: When `false`, users limited to single notebook (simplified UX for MVP).
- **Use Cases**:
  - MVP rollout with simplified UX
  - Testing single-notebook workflows
  - Reduced complexity for specific deployments

#### **FEATURE_FTS_SEARCH**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable full-text search using SQLite WASM with in-memory index.
- **Impact**: Search index is rebuilt in background when notebook opens; no persistent storage required.
- **Dependencies**: None (uses in-memory SQLite WASM).
- **Use Cases**:
  - Gradual rollout of search functionality
  - Low-powered device optimization
  - Reduced storage footprint

#### **FEATURE_OPFS_CACHE**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Use Origin Private File System for caching encrypted blobs and manifests.
- **Fallback**: Memory-only or IndexedDB when disabled or unavailable.
- **Use Cases**:
  - Browser compatibility issues
  - Alternative storage backend testing
  - Privacy-focused configurations

#### **FEATURE_AUTO_SYNC**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable automatic periodic synchronization with remote storage.
- **Related**: `FEATURE_SYNC_INTERVAL_MS` (default: 300000 = 5 minutes).
- **Use Cases**:
  - Manual-only sync workflows
  - Reduced network usage
  - Testing sync behavior

### Security & Encryption Flags

#### **FEATURE_CRYPTOGRAPHY**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Master switch for encryption functionality. When `false`, all data is stored unencrypted.
- **Impact**:
  - `false`: No encryption/decryption operations, no KDF derivations, no crypto keys
  - `true`: Full encryption pipeline as designed
- **Use Cases**:
  - Development/testing environments
  - Local-only deployments where encryption overhead is unnecessary
  - Performance testing and debugging
- **Warning**: Should NEVER be disabled in production deployments with remote storage.

#### **FEATURE_ARGON2_KDF**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Use Argon2id for FKEK derivation. When `false`, falls back to PBKDF2-SHA256.
- **Security Note**: PBKDF2 is faster but less resistant to GPU/ASIC attacks.
- **Use Cases**:
  - Low-powered devices where Argon2id is too slow
  - Environments lacking Argon2id support
  - Performance testing

#### **FEATURE_KDF_PROFILE**
- **Type**: `'fast' | 'balanced' | 'paranoid'`
- **Default**: `'balanced'`
- **Description**: Controls KDF parameter strength for FKEK derivation (Argon2id).
- **Parameters**:
  ```typescript
  fast: {
    iterations: 1,
    memory: 16384,      // 16 MB
    parallelism: 1,
    time_estimate: "~100ms"
  }
  balanced: {
    iterations: 3,
    memory: 65536,      // 64 MB
    parallelism: 4,
    time_estimate: "~500ms"
  }
  paranoid: {
    iterations: 10,
    memory: 262144,     // 256 MB
    parallelism: 8,
    time_estimate: "~3-5s"
  }
  ```
- **Use Cases**:
  - `fast`: Low-powered devices, development, testing
  - `balanced`: Standard security for most users
  - `paranoid`: High-security requirements, powerful devices, highly sensitive data

#### **FEATURE_ZK_STRICT_MODE**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable extra validation that no plaintext ever leaves client.
- **Impact**: Additional runtime checks, useful for security auditing.
- **Checks**:
  - Verify all outbound data is encrypted
  - Log any potential plaintext leaks
  - Validate encryption parameters before operations
- **Use Cases**:
  - Security audits
  - Compliance requirements
  - Development and testing

### Performance & Optimization Flags

#### **FEATURE_PARALLEL_NOTEBOOK_LOAD**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Load and decrypt multiple notebooks concurrently (Section 6 notes parallel loading capability).
- **Impact**: Faster multi-notebook loading but higher memory/CPU burst.
- **Use Cases**:
  - Multi-notebook workflows
  - Powerful devices
  - Sequential loading for resource-constrained devices

#### **FEATURE_LAZY_BLOB_LOAD**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Fetch and decrypt blobs only when accessed, not during manifest load.
- **Impact**: Reduces initial load time and bandwidth usage.
- **Trade-off**: Slight delay when first opening a note/image.
- **Use Cases**:
  - Slow network connections
  - Large notebooks with many blobs
  - Mobile devices with limited bandwidth

#### **FEATURE_AGGRESSIVE_MANIFEST_CACHE**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Cache manifests more aggressively, reducing re-fetch frequency.
- **Trade-off**: Better performance vs potentially stale data.
- **Impact**: May delay detection of remote changes.
- **Use Cases**:
  - Single-device workflows
  - Reduced network usage requirements
  - Performance-critical environments

#### **FEATURE_CRYPTO_WORKER**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Offload cryptographic operations to Web Worker.
- **Impact**: Prevents blocking main thread during encryption/decryption.
- **Dependencies**: Requires Web Worker support in browser.
- **Use Cases**:
  - Smooth UI during crypto operations
  - Large file encryption/decryption
  - Fallback to main thread when workers unavailable

#### **FEATURE_BLOB_COMPRESSION**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Compress blobs before encryption (gzip/deflate).
- **Impact**: Reduces storage space and bandwidth, adds CPU overhead.
- **Trade-off**: Compression time vs storage/bandwidth savings.
- **Use Cases**:
  - Bandwidth-constrained environments
  - Storage cost optimization
  - Disable for pre-compressed content (images, videos)

### Conflict Resolution Flags

#### **FEATURE_CONFLICT_STRATEGY**
- **Type**: `'lww' | 'manual' | 'auto-merge'`
- **Default**: `'lww'`
- **Description**: Strategy for handling sync conflicts (Section 7).
  - `lww`: Last-Write-Wins based on timestamp (current implementation)
  - `manual`: Prompt user to resolve conflicts interactively
  - `auto-merge`: Attempt automatic merge (future enhancement)
- **Use Cases**:
  - Different user preferences for conflict handling
  - A/B testing conflict resolution UX
  - Future advanced merge capabilities

#### **FEATURE_CONFLICT_NOTIFICATIONS**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Notify users when conflicts are auto-resolved.
- **Impact**: Improves transparency of sync behavior.
- **Use Cases**:
  - User awareness of data changes
  - Debugging sync issues
  - Silent operation for automated systems

### Storage & Sync Flags

#### **FEATURE_MAP_REALTIME_SYNC**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Poll for `map.json.enc` changes more frequently (detects new notebooks faster).
- **Impact**: Higher server requests, faster cross-device notebook discovery.
- **Trade-off**: Network overhead vs sync speed.
- **Use Cases**:
  - Active multi-device workflows
  - Real-time collaboration scenarios
  - Reduced polling for single-device usage

#### **FEATURE_BLOB_DEDUP**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable hash-based deduplication for identical blobs (especially Sigils/images).
- **Impact**: Saves storage space, adds complexity to manifest management.
- **Implementation**: Compare blob hashes before upload, reuse existing blob UUID.
- **Use Cases**:
  - Large notebooks with duplicate images
  - Storage cost optimization
  - Reduced bandwidth usage

#### **FEATURE_TITLE_SYNC_PRIORITY**
- **Type**: `'map' | 'manifest'`
- **Default**: `'manifest'`
- **Description**: When map and manifest titles diverge, which is authoritative (Section 7).
- **Current Design**: Manifest is source of truth.
- **Use Cases**:
  - Testing different sync strategies
  - Resolving edge cases in title synchronization
  - Future optimization of title updates

#### **FEATURE_SYNC_INTERVAL_MS**
- **Type**: `number`
- **Default**: `300000` (5 minutes)
- **Description**: Interval between automatic sync operations.
- **Valid Range**: 60000 (1 min) to 3600000 (1 hour)
- **Dependencies**: Requires `FEATURE_AUTO_SYNC=true`.
- **Use Cases**:
  - Balance between sync freshness and server load
  - Different intervals for different user tiers
  - Network condition adaptation

### User Experience Flags

#### **FEATURE_OFFLINE_MODE**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Allow full offline editing with deferred sync queue.
- **Impact**: Graceful handling of network disconnections.
- **Implementation**: Queue changes locally, sync when connection restored.
- **Use Cases**:
  - Mobile/traveling users
  - Unreliable network environments
  - Airplane mode usage

#### **FEATURE_IMAGE_THUMBNAILS**
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Generate and cache thumbnails for Sigils (images).
- **Impact**: Improves gallery/preview performance, increases storage usage.
- **Implementation**: Generate thumbnails on upload/first view.
- **Use Cases**:
  - Image-heavy notebooks
  - Gallery views
  - Reduced for storage-constrained devices

#### **FEATURE_ONBOARDING_V2**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable experimental onboarding flow for new users.
- **Use Case**: A/B testing UX improvements.
- **Rollout**: Gradual percentage-based rollout for new users.

### Developer & Debug Flags

#### **FEATURE_DEBUG_CRYPTO**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable detailed logging for cryptographic operations.
- **Logged Operations**:
  - Key derivation timing
  - Encryption/decryption operations
  - Crypto worker messages
- **Use Cases**:
  - Debugging crypto issues
  - Performance profiling
  - Security auditing

#### **FEATURE_DEBUG_SYNC**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable detailed logging for sync operations.
- **Logged Operations**:
  - Sync triggers and intervals
  - Conflict detection and resolution
  - Upload/download operations
- **Use Cases**:
  - Debugging sync issues
  - Understanding sync behavior
  - Troubleshooting conflicts

#### **FEATURE_DEBUG_STORAGE**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable detailed logging for storage operations (OPFS, IndexedDB).
- **Logged Operations**:
  - File read/write operations
  - Cache hits/misses
  - Storage quota usage
- **Use Cases**:
  - Debugging storage issues
  - Cache performance analysis
  - Storage capacity planning

#### **FEATURE_PERFORMANCE_METRICS**
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Collect and report timing data for operations.
- **Metrics Collected**:
  - KDF derivation time
  - Encryption/decryption duration
  - Network request latency
  - Sync operation timing
- **Impact**: Helps identify performance bottlenecks in production.
- **Use Cases**:
  - Performance monitoring
  - User experience optimization
  - Capacity planning

#### **FEATURE_STORAGE_BACKEND**
- **Type**: `'default' | 's3' | 'cloudflare-r2' | 'azure-blob' | 'custom'`
- **Default**: `'default'`
- **Description**: Configurable object storage backend.
- **Use Cases**:
  - Multi-cloud support
  - Self-hosted deployments
  - Cost optimization across providers
  - Geographic redundancy
