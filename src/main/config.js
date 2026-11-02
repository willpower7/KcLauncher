"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.exports = {
  APP_NAME: "KcLauncher",
  APP_TITLE: "Keychron Launcher",
  LAUNCHER_URL: "https://launcher.keychron.com",
  FALLBACK_OFFLINE_URL: path.join(__dirname, "..", "renderer", "offline.html"),
  MIRRORED_LOCAL_URL: path.join(__dirname, "..", "renderer", "mirrored", "index.html"),
  PROFILES_DIR_NAME: "profiles",

  // Supported USB Hardware Vendors & Bootloaders
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
  OFFLINE_MODE: process.env.KEYCHRON_OFFLINE === "1",
  USE_LOCAL_MIRROR: process.env.KEYCHRON_LOCAL_MIRROR === "1",

  // Resolved initial launcher target URL
  getHomeUrl() {
    if (this.OFFLINE_MODE) {
      return `file://${this.FALLBACK_OFFLINE_URL}?forced=1`;
    }
    if (this.USE_LOCAL_MIRROR && fs.existsSync(this.MIRRORED_LOCAL_URL)) {
      return `file://${this.MIRRORED_LOCAL_URL}`;
    }
    return this.LAUNCHER_URL;
  }
};

