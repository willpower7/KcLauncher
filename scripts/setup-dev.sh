#!/bin/bash
set -e

echo "=== KcLauncher Environment Setup ==="

# Check for node
if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is not installed."
    echo "On Ubuntu/Pop!_OS/Debian, install Node.js via:"
    echo "  sudo apt update && sudo apt install -y nodejs npm"
    echo "Or via nvm / NodeSource (recommended for Node.js 20+):"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt install -y nodejs"
    exit 1
fi

echo "Node.js version: $(node -v)"
echo "npm version:     $(npm -v)"

echo "Installing project dependencies..."
npm install

echo "✓ Environment ready! Run 'npm start' or 'npm run dev' to launch KcLauncher."
