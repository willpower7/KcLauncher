"use strict";

const { contextBridge } = require("electron");

// Expose safe desktop integration indicator without leaking sensitive runtime versions
contextBridge.exposeInMainWorld("kclauncher", {
  isElectron: true
});
