#!/bin/bash
# ==============================================================================
# KcLauncher Hardware & udev Diagnostics Script
# ==============================================================================

set -e

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
NC="\033[0m"

echo -e "${BLUE}=== KcLauncher Linux Hardware Diagnostics ===${NC}"
echo "Current user: $(whoami)"
echo "Current date: $(date)"
echo ""

# 1. Check udev rules
echo -e "${BLUE}[1/4] Checking udev rules...${NC}"
FOUND_RULE=false

if [ -f "/lib/udev/rules.d/60-keychron.rules" ]; then
    echo -e "  ${GREEN}✓ Found /lib/udev/rules.d/60-keychron.rules (Installed via package)${NC}"
    FOUND_RULE=true
fi

if [ -f "/etc/udev/rules.d/60-keychron.rules" ] || [ -f "/etc/udev/rules.d/99-keychron.rules" ]; then
    echo -e "  ${GREEN}✓ Found custom rule in /etc/udev/rules.d/${NC}"
    FOUND_RULE=true
fi

if [ "$FOUND_RULE" = false ]; then
    echo -e "  ${RED}✗ No Keychron udev rules found!${NC}"
    echo "    Fix: Run 'bash scripts/install-udev.sh' or install the .deb package."
fi
echo ""

# 2. Check connected USB devices
echo -e "${BLUE}[2/4] Scanning for Keychron & bootloader hardware (USB)...${NC}"
KEYCHRON_DEVICES=$(lsusb 2>/dev/null | grep -i -E "3434|34b7|0483:df11|2e8a:0003" || true)

if [ -n "$KEYCHRON_DEVICES" ]; then
    echo -e "${GREEN}Detected compatible devices:${NC}"
    echo "$KEYCHRON_DEVICES" | sed 's/^/  • /'
else
    echo -e "${YELLOW}⚠ No Keychron devices detected on USB.${NC}"
    echo "  Ensure your keyboard/mouse is:"
    echo "   1. Connected via USB cable (WebHID cannot configure over Bluetooth)"
    echo "   2. Toggled to 'Cable' mode on the physical switch"
fi
echo ""

# 3. Check /dev/hidraw permissions
echo -e "${BLUE}[3/4] Checking /dev/hidraw* device permissions...${NC}"
if ls /dev/hidraw* >/dev/null 2>&1; then
    ACCESSIBLE_COUNT=0
    TOTAL_COUNT=0
    for dev in /dev/hidraw*; do
        TOTAL_COUNT=$((TOTAL_COUNT + 1))
        if [ -r "$dev" ] && [ -w "$dev" ]; then
            ACCESSIBLE_COUNT=$((ACCESSIBLE_COUNT + 1))
        fi
    done
    echo "  Total hidraw nodes: $TOTAL_COUNT"
    echo -e "  Nodes with read/write access for $(whoami): ${GREEN}$ACCESSIBLE_COUNT${NC}"
    if [ "$ACCESSIBLE_COUNT" -eq 0 ]; then
        echo -e "  ${RED}✗ No hidraw nodes are accessible to user $(whoami).${NC}"
        echo "    Run: sudo udevadm control --reload-rules && sudo udevadm trigger"
    fi
else
    echo -e "  ${YELLOW}No /dev/hidraw* nodes currently present.${NC}"
fi
echo ""

# 4. Check system group memberships
echo -e "${BLUE}[4/4] Checking desktop session & access control...${NC}"
if command -v loginctl >/dev/null 2>&1; then
    SESSION_ID=$(loginctl session-status 2>/dev/null | head -n 1 | awk '{print $1}' || echo "")
    if [ -n "$SESSION_ID" ]; then
        echo -e "  ${GREEN}✓ Active systemd-logind session: $SESSION_ID (uaccess ACLs supported)${NC}"
    fi
fi

echo ""
echo -e "${BLUE}=== Diagnostics Complete ===${NC}"
