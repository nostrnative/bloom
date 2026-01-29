# Blossom Protocol Implementation Plan

## Overview
Implement a Blossom server as a Tauri application that works on desktop (Windows, macOS, Linux) and mobile (iOS, Android) with background service support.

## Project Goals
- Implement all mandatory BUDs (00, 01, 02)
- Implement optional BUDs (03-10)
- Run background service on mobile devices
- Support Nostr authentication
- Cross-platform compatibility

## BUD Implementation Priority

### Phase 1: Core Foundation (Mandatory)
- [x] **BUD-00**: Base language and requirements
- [x] **BUD-01**: Server requirements and blob retrieval
  - [x] GET /<sha256> endpoint
  - [x] HEAD /<sha256> endpoint
  - [x] CORS headers
  - [x] Range request support
- [x] **BUD-02**: Blob upload and management
  - [x] PUT /upload endpoint
  - [x] DELETE /<sha256> endpoint
  - [x] GET /list/<pubkey> endpoint
  - [x] Blob descriptor format
  - [ ] Nostr Authentication (Optional/Disabled)

### Phase 2: Mobile Background Service
- [ ] iOS Background Tasks
- [x] Android Foreground Services
- [x] Rust async background worker
- [ ] Persistent notifications
- [ ] Network-aware sync

### Phase 3: Enhanced Features (Optional)
- [ ] **BUD-03**: User Server List (kind:10063)
- [x] **BUD-04**: Mirroring blobs (PUT/mirror)
- [x] **BUD-05**: Media optimization (PUT/media)
- [x] **BUD-06**: Upload requirements (HEAD/upload)
- [ ] **BUD-07**: Payment required (402 responses)
- [ ] **BUD-08**: NIP-94 File Metadata tags
- [x] **BUD-09**: Blob reporting (PUT/report)
- [x] **BUD-10**: Blossom URI schema (Basic resolution)

### Phase 4: Frontend Integration
- [x] Tauri commands for frontend communication
- [x] Upload UI
- [x] Blob browser
- [ ] Background sync status
- [ ] Server configuration

## Project Structure
```
blossom/
├── PLAN.md
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   ├── http_server.rs       # Axum HTTP server
│   │   ├── storage.rs           # Blob storage manager
│   │   ├── auth.rs              # Authorization logic (verified 24242)
│   │   ├── mobile/              # Mobile background services
│   │   │   ├── mod.rs
│   │   │   ├── ios.rs
│   │   │   └── android.rs
│   │   └── commands/            # Tauri commands
│   │       ├── mod.rs
│   │       ├── app.rs
│   │       └── nostr/           # Nostr logic (Calendar, Keys, etc.)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                         # Frontend (React)
│   ├── App.tsx
│   └── components/
└── package.json
```

## Dependencies
... (existing dependencies)