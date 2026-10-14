"use strict";

const { app, Menu, shell, dialog } = require("electron");

function buildAppMenu(mainWindow) {
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
          label: "Reload Launcher",
          accelerator: "CmdOrCtrl+R",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.reload();
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
        {
          label: "Linux udev Permissions Info",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Linux Hardware Access (udev)",
              message: "Keychron Hardware Permissions",
              detail:
                "KcLauncher uses /lib/udev/rules.d/60-keychron.rules to grant non-root users access to Keychron keyboards.\n\n" +
                "Vendor ID: 0x3434\n" +
                "If your device is not connecting:\n" +
                "1. Make sure the keyboard switch is set to 'Cable' (not BT/2.4GHz)\n" +
                "2. Try unplugging and re-plugging the USB cable\n" +
                "3. Run: sudo udevadm control --reload-rules && sudo udevadm trigger",
              buttons: ["OK"]
            });
          }
        },
        { type: "separator" },
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
