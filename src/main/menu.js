"use strict";

const { app, Menu, shell, dialog } = require("electron");
const config = require("./config");

function buildAppMenu(mainWindow, onCheckUpdates) {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" }
            ]
          }
        ]
      : []),
    {
      label: "&File",
      submenu: [
        {
          label: "Return to Launcher Home",
          accelerator: "CmdOrCtrl+Home",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.loadURL(config.LAUNCHER_URL);
            }
          }
        },
        {
          label: "Reload Launcher",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: "Hard Reload (Clear Cache)",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit", accelerator: "CmdOrCtrl+Q" }
      ]
    },
    {
      label: "&Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "&View",
      submenu: [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { type: "separator" },
        {
          label: "Toggle Developer Tools",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: "&Device",
      submenu: [
        {
          label: "Rescan Hardware Devices",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reload();
            }
          }
        },
        { type: "separator" },
        {
          label: "Linux Hardware Access & Permissions...",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Linux Hardware Access Status",
              message: "Keychron Hardware Permissions & Drivers",
              detail:
                "• USB Vendor IDs: 0x3434 (Keychron/Lemokey), 0x34b7 (XinJi Mice & 4K Receivers)\n" +
                "• Bootloader IDs: 0x0483:df11 (STM32 DFU), 0x2e8a:0003 (RP2040)\n" +
                "• udev Rules File: /lib/udev/rules.d/60-keychron.rules\n\n" +
                "Requirements:\n" +
                "1. Keyboard switch set to 'Cable' mode (not BT or 2.4GHz)\n" +
                "2. Direct USB connection to PC\n\n" +
                "For terminal diagnostics, run:\n" +
                "  bash scripts/verify-udev.sh",
              buttons: ["OK"]
            });
          }
        },
        {
          label: "Connection Troubleshooting Guide",
          click: async () => {
            await shell.openExternal("https://www.keychron.com/pages/keymap");
          }
        }
      ]
    },
    {
      label: "&Help",
      submenu: [
        {
          label: "Keychron Official Guide",
          click: async () => {
            await shell.openExternal("https://www.keychron.com/pages/keymap");
          }
        },
        {
          label: "Firmware Flashing Guide",
          click: async () => {
            await shell.openExternal(
              "https://www.keychron.com/pages/how-to-factory-reset-or-use-the-launcher-web-app-to-flash-firmware-for-your-keyboard"
            );
          }
        },
        { type: "separator" },
        ...(onCheckUpdates
          ? [
              {
                label: "Check for Updates...",
                click: onCheckUpdates
              },
              { type: "separator" }
            ]
          : []),
        {
          label: "About KcLauncher",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About KcLauncher",
              message: `KcLauncher v${app.getVersion()}`,
              detail:
                "Native Linux desktop application port of Keychron Launcher.\n" +
                "Built with Electron and WebHID for full keyboard, mouse, and macro configuration on Linux.\n\n" +
                "GitHub: https://github.com/willpower7/KcLauncher",
              buttons: ["OK"]
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { buildAppMenu };
