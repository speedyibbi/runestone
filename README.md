# Runestone

**A zero-knowledge, end-to-end encrypted note-taking application where your data remains truly yours.**

Runestone is built on a fundamental principle: **the server should never see your data**. Not your notes, not your titles, not your metadata—nothing. All encryption and decryption happens entirely on your device, making it impossible for anyone—including us—to access your content.

---

## Core Philosophy

### 🔐 Zero-Knowledge Architecture

The server in Runestone is intentionally "dumb." It functions purely as a storage mapper—receiving opaque, encrypted blobs and returning them on request. The server:

- Never receives your passphrase (only a derived lookup hash)
- Never sees encryption keys
- Never accesses decrypted content
- Has no knowledge of what's stored—just UUIDs and encrypted data

Even if the server were compromised, an attacker would find only meaningless encrypted files with no way to identify their contents or owners.

### 🛡️ Multi-Layer Encryption

Runestone employs a sophisticated three-tier key system to protect your data:

1. **Passphrase Derivation** — Your passphrase is transformed using SHA256 into a lookup hash, which serves as both your identity and the root of all key derivations.

2. **Key Encryption Keys** — Strong key derivation functions (PBKDF2 and Argon2id) generate keys that protect your actual encryption keys, adding an extra layer of defense.

3. **Content Encryption** — All data is encrypted with AES-256-GCM, a military-grade cipher that ensures both confidentiality and integrity.

Each notebook (called a *Codex*) has its own independent encryption key, meaning compromising one doesn't expose the others.

### 💭 Memory-Only Decryption

Your sensitive data exists in decrypted form only in memory, never on disk:

- **One item at a time** — Only the content you're actively viewing is decrypted
- **No plaintext persistence** — Encrypted data is cached locally, but decrypted content never touches storage
- **Ephemeral indices** — Search and graph features rebuild their indices in memory each session

When you close a note, the decrypted content is gone. When you close the app, everything sensitive vanishes.

---

## Features

- **Rich Markdown Editing** — Write in markdown with live preview, syntax highlighting, and media embedding
- **Full-Text Search** — Search across all your notes with relevance ranking—powered by an in-memory index that never persists
- **Knowledge Graph** — Visualize connections between notes through wiki-style links and hashtags
- **Multi-Notebook Support** — Organize your thoughts into separate Codexes, each independently encrypted
- **Offline-First** — Work without an internet connection; sync when you're ready
- **Cross-Platform** — Access your encrypted notes from any device with a modern browser

---

## Terminology

Runestone uses thematic naming to reflect its design philosophy:

| Technical Term | User-Facing Name |
|----------------|------------------|
| Notebook       | **Codex**        |
| Note           | **Rune**         |
| Media file     | **Sigil**        |

---

## Who Is This For?

Runestone is for anyone who values privacy:

- **Journalists** protecting sources and sensitive information
- **Researchers** working with confidential data
- **Professionals** handling client-privileged information
- **Privacy advocates** who believe personal thoughts should remain personal
- **Anyone** tired of trading privacy for convenience

If you've ever wondered whether your note-taking app is reading your data, training AI on your thoughts, or selling your information—Runestone is the answer: **we can't, because we never see it.**

---

## The Promise

With Runestone, your notes are:

- **Private** — Encrypted before leaving your device
- **Secure** — Protected by industry-standard cryptography
- **Yours** — We have zero knowledge of your content

Your thoughts deserve to stay your own.

---

<p align="center">
  <em>Write freely. Think privately.</em>
</p>
