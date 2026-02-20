#!/bin/bash

# Exit on any error
set -e

# 3. Tauri Build (Check if everything compiles together)
echo "📦 Building Tauri application..."
# We use 'cargo check' for a fast validation of the Tauri integration
# or we can do a full build if requested. 
# Since the user asked to "build the project", we'll run tauri build
npm run tauri build -- --no-bundle # --no-bundle makes it faster for a check

echo "✅ Build and checks completed successfully!"
