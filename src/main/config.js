"use strict";

const path = require("node:path");

module.exports = {
  APP_NAME: "KcLauncher",
  APP_TITLE: "Keychron Launcher",
  LAUNCHER_URL: "https://launcher.keychron.com",
  FALLBACK_OFFLINE_URL: path.join(__dirname, "..", "renderer", "offline.html"),
  
  // Keychron Hardware USB Vendor IDs
  VENDOR_IDS: {
    KEYCHRON: 0x3434, // 13364 decimal
    STM32_DFU: 0x0483, // Bootloader for flashing
    RP2040_BOOTLOADER: 0x2e8a
  },

  // Allowed web origin patterns for WebHID and navigation security
  ALLOWED_HOST_PATTERNS: [
    "launcher.keychron.com",
    "keychron.com",
    "www.keychron.com",
    "*.keychron.com",
    "launcher.keychron.cn",
    "*.keychron.cn"
  ],

  // Window geometry defaults
  WINDOW: {
    DEFAULT_WIDTH: 1366,
    DEFAULT_HEIGHT: 860,
    MIN_WIDTH: 1024,
    MIN_HEIGHT: 680,
    STATE_FILE: "kclauncher-window-state.json"
  },

  // Environment feature flags
  DEBUG: process.env.KEYCHRON_DEBUG === "1",
  DEVTOOLS: process.env.KEYCHRON_DEVTOOLS === "1",
  OFFLINE_MODE: process.env.KEYCHRON_OFFLINE === "1"
};
