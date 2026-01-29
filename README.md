# 🌸 Blossom Server

A Tauri-based implementation of the [Blossom Protocol](https://github.com/hzrd149/blossom) - a decentralized media storage system for the Nostr ecosystem.

## Features

### Fully Implemented BUDs

✅ **BUD-00**: Base Language and Requirements
✅ **BUD-01**: Server Requirements and Blob Retrieval
- GET /<sha256> endpoint
- HEAD /<sha256> endpoint
- CORS support
- Range request support for mobile bandwidth optimization

✅ **BUD-02**: Blob Upload and Management
- PUT /upload endpoint
- DELETE /<sha256> endpoint
- GET /list/<pubkey> endpoint (basic)
- Blob descriptor format with NIP-94 support

✅ **BUD-03**: User Server List
- Kind 10063 event support
- Server list publishing
- Fetching user's server lists

✅ **BUD-04**: Mirroring Blobs
- PUT /mirror endpoint
- Remote blob downloading and verification

✅ **BUD-05**: Media Optimization
- PUT /media endpoint
- Media type detection

✅ **BUD-06**: Upload Requirements
- HEAD /upload endpoint
- Pre-upload validation

✅ **BUD-07**: Payment Required
- 402 Payment Required status support
- Lightning (BOLT-11) and Cashu (NUT-24) support

✅ **BUD-08**: NIP-94 File Metadata
- Full NIP-94 tag support
- Metadata extraction and generation

✅ **BUD-09**: Blob Reporting
- PUT /report endpoint
- NIP-56 report event support

✅ **BUD-10**: Blossom URI Schema
- URI parsing and generation
- Resolution strategy

## Getting Started

### Prerequisites

- Rust 1.77.2+
- Node.js 18+
- Tauri CLI

### Installation

```bash
# Clone the repository
cd blossom

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

## Project Structure

```
blossom/
├── src/                    # Frontend
│   ├── index.html          # Main UI
│   └── app.js             # Frontend logic
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── http_server.rs  # Axum HTTP server
│   │   ├── storage.rs      # Blob storage manager
│   │   ├── nostr.rs        # Nostr auth handler
│   │   ├── auth.rs         # Authorization logic
│   │   ├── mobile/         # Mobile background services
│   │   └── buds/          # BUD implementations
│   ├── Cargo.toml
│   └── tauri.conf.json
└── PLAN.md                # Implementation plan
```

## Usage

### Starting the Server

The server automatically starts when you run the Tauri app:

```bash
npm run tauri dev
```

The HTTP server will be available at `http://localhost:8080`

### Uploading Blobs

You can upload files through the web interface:

1. Drag and drop a file onto the upload area
2. The file will be automatically uploaded
3. The blob URL will be displayed

### Nostr Authentication

The server supports Nostr authentication for protected operations:

```
Authorization: Nostr <base64_encoded_event>
```

Example authorization event:
```json
{
  "kind": 24242,
  "content": "Upload Blob",
  "created_at": 1708773959,
  "tags": [
    ["t", "upload"],
    ["x", "b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553"],
    ["expiration", "1708858680"]
  ]
}
```

## API Endpoints

### BUD-01: Blob Retrieval

```bash
# Get blob
GET /<sha256>

# Check blob existence
HEAD /<sha256>
```

### BUD-02: Upload/Management

```bash
# Upload blob
PUT /upload

# Delete blob
DELETE /<sha256>

# List user's blobs
GET /list/<pubkey>
```

### BUD-04: Mirroring

```bash
# Mirror blob from URL
PUT /mirror
Content-Type: application/json

{
  "url": "https://example.com/blob.pdf"
}
```

### BUD-05: Media Optimization

```bash
# Optimize media
PUT /media
```

### BUD-06: Upload Requirements

```bash
# Check upload requirements
HEAD /upload
X-SHA-256: <hash>
X-Content-Length: <size>
X-Content-Type: <mime_type>
```

### BUD-09: Reporting

```bash
# Report blob
PUT /report
Content-Type: application/json

{
  "kind": 1984,
  "tags": [["x", "<sha256>", "<type>"]],
  "content": "Reason for report"
}
```

## Mobile Support

### iOS
- Background tasks for sync
- File system access
- Push notifications

### Android
- Foreground service
- WorkManager for periodic tasks
- Persistent notifications

## Configuration

Server settings are configured in `src-tauri/tauri.conf.json`:

- Server port: 8080
- Storage location: App local data directory
- Max upload size: 100 MiB

## Development

### Running Tests

```bash
cd src-tauri
cargo test
```

### Building for Production

```bash
# Desktop
npm run tauri build

# iOS
npm run tauri build --target ios

# Android
npm run tauri build --target android
```

## License

MIT License

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Links

- [Blossom Protocol](https://github.com/hzrd149/blossom)
- [Blossom.nostr.build](https://blossom.nostr.build/)
- [Nostr Protocol](https://github.com/nostr-protocol/nostr)
