# Sync Plan: Nostr Events & Blossom Blobs

This document outlines the strategy for implementing bi-directional synchronization between the local Blossom server/app and remote Nostr relays/Blossom servers.

## 1. Overview
Syncing in Blossom involves two distinct data types:
1.  **Nostr Events**: Structured metadata (Calendars, Contacts, File Metadata).
2.  **Blossom Blobs**: Large binary files (Images, Videos, Documents).

## 2. Best Syncing Methods

### A. Nostr Event Sync (Set Reconciliation)
*   **Negentropy (NIP-77)**: (Recommended) An efficient set reconciliation protocol. It allows two relays (or a client and a relay) to find the symmetric difference between their event sets with minimal bandwidth.
*   **Time-based REQs**: Subscribing with a `since` filter. Good for incremental updates but unreliable for historical sync or resolving gaps.
*   **Outbox Model (NIP-65)**: Discovering which relays to sync with by looking at a user's relay list.

### B. Blossom Blob Sync
*   **List & Mirror (BUD-01/04)**: Listing blobs for a pubkey on a remote server and using `PUT /mirror` to pull them locally.
*   **User Server List (BUD-03)**: Using `kind:10063` events to find a user's preferred Blossom servers for discovery.
*   **Blob Inventory Reconciliation**: Comparing local file hashes with remote lists.

---

## 3. Implementation Steps

### Step 1: Event Reconciliation with Negentropy
1.  **Library Selection**: Integrate a Rust-based Negentropy library (e.g., `negentropy` crate or `nostr-sdk`'s built-in support).
2.  **Sync Logic**: 
    *   For each configured remote relay, initiate a Negentropy session.
    *   Reconcile specific kinds: `31922` (Time-based Calendars), `31923` (Date-based Calendars), `3` (Contacts), `10063` (Blossom Servers), and `1063` (File Metadata).
    *   Download missing events and store them in the local database.
3.  **Frequency**: Run full reconciliation on app startup and periodically (e.g., every 30 minutes).

### Step 2: Blob Discovery and Pull
1.  **Parse Metadata**: Extract blob hashes (sha256) from received `kind:1063` events.
2.  **Server Discovery**: Use `kind:10063` to find where the author stores their blobs.
3.  **Pull Mechanism**: 
    *   Check if blob exists locally.
    *   If missing, call the internal `mirror_blob` logic to fetch from remote servers.
    *   Verify hash integrity after download.

### Step 3: Bi-directional Sync (Push)
1.  **Identify Local Changes**: Track blobs uploaded to the local server that haven't been mirrored to the user's remote servers.
2.  **Push Mechanism**: 
    *   Iterate through remote Blossom servers defined in the user's `kind:10063`.
    *   Call `PUT /mirror` on the remote server, providing the local blob's URL.

### Step 4: Real-time Updates
1.  **WebSocket Subscriptions**: Keep active `REQ` subscriptions to "home" relays.
2.  **Immediate Action**: When a new `kind:1063` is received via WebSocket, immediately queue the associated blob for mirroring.

---

## 4. Configuration Options

| Option | Description | Recommended |
|--------|-------------|-------------|
| `remote_relays` | List of Nostr relays to sync events with. | Damus, Nos.lol, etc. |
| `sync_interval` | Minutes between background sync cycles. | 15-30 minutes |
| `auto_mirror` | Automatically download blobs from followed users. | Enabled (on WiFi) |
| `outbox_sync` | Automatically discover relays via NIP-65. | Enabled |
| `negentropy_enabled`| Use Negentropy for efficient sync. | Enabled |

## 5. Future Considerations
*   **Bandwidth Management**: Only sync blobs on unmetered connections (mobile vs. desktop).
*   **Partial Sync**: For calendars, only sync events in the future or recent past.
*   **Storage Quotas**: Limit local storage used by mirrored blobs from other users.
