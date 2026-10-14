#!/bin/bash
set -e

# Installs Keychron udev rules onto the local Linux machine
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_SRC="${SCRIPT_DIR}/../build/udev/60-keychron.rules"
RULES_DEST="/etc/udev/rules.d/60-keychron.rules"

echo "=== Keychron udev Rules Installer ==="
if [ ! -f "$RULES_SRC" ]; then
    echo "Error: Cannot find $RULES_SRC"
    exit 1
fi

echo "Installing $RULES_SRC -> $RULES_DEST..."
sudo cp "$RULES_SRC" "$RULES_DEST"
sudo chmod 644 "$RULES_DEST"

echo "Reloading udev daemon..."
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=hidraw || true
sudo udevadm trigger --subsystem-match=usb || true

echo "✓ Keychron udev rules installed and reloaded successfully!"
echo "Note: If your keyboard is currently plugged in, unplug and replug the USB cable."
