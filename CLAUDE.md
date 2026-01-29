# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Blossom Server is a Tauri-based implementation of the Blossom Protocol - a decentralized media storage system for the Nostr ecosystem. The application runs on desktop and mobile platforms, implementing various Blossom Upgrade Documents (BUDs) for blob storage, retrieval, and management.

## Architecture

### Technology Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite
- **Backend**: Rust with Tauri 2.0 framework
- **HTTP Server**: Axum web framework
- **State Management**: Zustand store
- **Data Fetching**: TanStack Query (React Query)
- **UI Components**: Radix UI primitives

### Project Structure
```
src/                     # React frontend
├── app/                 # Main app components
├── components/          # Reusable UI components
├── hooks/              # Custom React hooks
└── lib/                # Utilities and configurations

src-tauri/              # Rust backend
├── src/
│   ├── lib.rs          # Main Tauri entry point
│   ├── http_server.rs  # Axum HTTP server
│   ├── storage.rs      # Blob storage manager
│   ├── nostr.rs        # Nostr authentication
│   ├── auth.rs         # Authorization logic
│   ├── mobile/         # Mobile background services
│   ├── buds/           # BUD implementations
│   └── commands/       # Tauri command handlers
```

## Common Development Commands

### Frontend Development
```bash
# Development server (starts both frontend and backend)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint JavaScript/TypeScript
npm run lint
```

### Tauri Commands
```bash
# Tauri development (recommended for full app testing)
npm run tauri dev

# Build desktop application
npm run tauri build

# Mobile development
npm run android    # Android development
npm run ios        # iOS development
```

### Rust Backend
```bash
cd src-tauri

# Run Rust tests
cargo test

# Check Rust code without building
cargo check

# Format Rust code
cargo fmt

# Lint Rust code
cargo clippy
```

## Key Implementation Details

### Nostr Integration
- Uses Nostr protocol for authentication and calendar event management
- Calendar events are published as Nostr events (kind 31922 for time-based, kind 31923 for date-based)
- RSVP system using Nostr events for calendar responses
- Contact management through Nostr contact lists

### Mobile Background Services
- iOS: Background tasks with BGProcessingTask
- Android: Foreground services with persistent notifications
- Cross-platform sync capabilities with configurable intervals

### HTTP Server
- Runs on port 8080 by default
- Implements Blossom Protocol endpoints for blob operations
- CORS support for web clients
- Range request support for mobile bandwidth optimization

### Authentication System
- Nostr-based authentication using kind 24242 events
- Authorization header format: `Authorization: Nostr <base64_encoded_event>`
- Event validation includes signature verification and expiration checks

## Configuration Files

### Important Config Files
- `src-tauri/tauri.conf.json`: Tauri app configuration
- `vite.config.ts`: Frontend build configuration with alias setup (@/ points to src/)
- `package.json`: Contains all development scripts
- `src-tauri/Cargo.toml`: Rust dependencies and build settings

### Path Alias
- Use `@/` prefix for imports from `src/` directory (configured in vite.config.ts)

## Development Notes

### State Management
- Main app state is managed with Zustand store (`src/lib/store`)
- React Query handles server state and caching
- Theme system supports light, dark, and system preferences

### Component Architecture
- Uses Radix UI primitives for accessible components
- Tailwind CSS for styling with CSS variables for theming
- Components follow compound component patterns where appropriate

### Rust Backend Modules
- Each BUD (Blossom Upgrade Document) has its own implementation module
- Mobile platform-specific code is separated into ios.rs and android.rs
- Async HTTP server runs concurrently with Tauri app lifecycle