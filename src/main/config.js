"use strict";

const path = require("node:path");

module.exports = {
  APP_NAME: "KcLauncher",
  APP_TITLE: "Keychron Launcher",
  LAUNCHER_URL: "https://launcher.keychron.com",
  FALLBACK_OFFLINE_URL: path.join(__dirname, "..", "renderer", "offline.html"),
  
  // Keychron Hardware USB Vendor IDs
  VENDOR_IDS: {
    KEYCHRON: 0x3434, // 13364 decimal (Keyboards, standard mice, Lemokey)
    KEYCHRON_WIRELESS: 0x34b7, // 13495 decimal (XinJi / Keychron wireless mice & 4K/8K receivers)
    STM32_DFU: 0x0483, // Bootloader for flashing (0483:df11)
    RP2040_BOOTLOADER: 0x2e8a // RP2040 Bootloader for flashing (2e8a:0003)
  },

  ALL_KEYCHRON_VENDORS: [0x3434, 0x34b7],
  ALL_BOOTLOADER_VENDORS: [0x0483, 0x2e8a],

  // Dedicated launcher web endpoints
  LAUNCHER_HOSTS: [
    "launcher.keychron.com",
    "launcher.keychron.cn"
  ],

  // Allowed web origin patterns for WebHID and navigation security
  ALLOWED_HOST_PATTERNS: [
    "launcher.keychron.com",
    "launcher.keychron.cn",
    "*.keychron.com",
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
