#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."

cd "$PROJECT_ROOT"

echo "=== Building KcLauncher .deb Package ==="

if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is not installed. Please run scripts/setup-dev.sh first."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "node_modules not found. Running npm install..."
    npm install
fi

echo "Running electron-builder to generate .deb..."
npm run build:deb

echo ""
echo "✓ Build complete!"
echo "Generated packages are available in: ${PROJECT_ROOT}/dist/"
ls -lh dist/*.deb 2>/dev/null || true
