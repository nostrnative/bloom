#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting full build and check process..."

# 1. Frontend Checks
echo "🎨 Checking frontend linting..."
npm run lint

echo "TypeScript type checking..."
npm run build # This runs tsc -b && vite build as defined in package.json

# 2. Backend Checks
echo "🦀 Checking backend code..."
cd src-tauri

echo "Checking formatting..."
cargo fmt -- --check

echo "Running Clippy (linting) and checking for errors/warnings..."
# Treating warnings as errors to ensure high quality
cargo clippy -- -D warnings

echo "Running Rust tests..."
cargo test

cd ..

# 3. Tauri Build (Check if everything compiles together)
echo "📦 Building Tauri application..."
# We use 'cargo check' for a fast validation of the Tauri integration
# or we can do a full build if requested. 
# Since the user asked to "build the project", we'll run tauri build
npm run tauri build -- --no-bundle # --no-bundle makes it faster for a check

echo "✅ Build and checks completed successfully!"
