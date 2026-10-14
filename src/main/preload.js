"use strict";

const { contextBridge, ipcRenderer } = require("electron");

// Expose safe system capabilities to renderer if needed
contextBridge.exposeInMainWorld("kclauncher", {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron
});
