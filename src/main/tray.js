"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, Tray, Menu, nativeImage } = require("electron");
const config = require("./config");

let tray = null;
let runInBackground = false;

function getTrayIcon() {
  const iconPaths = [
    path.join(__dirname, "..", "assets", "icons", "64x64.png"),
    path.join(__dirname, "..", "assets", "icon.png")
  ];

  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) {
        const targetSize = process.platform === "darwin" ? 22 : 32;
        return img.resize({ width: targetSize, height: targetSize });
      }
    }
  }
  return null;
}

function createTray(mainWindow, onCheckUpdates) {
  if (tray) return tray;

  const icon = getTrayIcon();
  if (!icon) {
    if (config.DEBUG) console.warn("[KcLauncher:Tray] Tray icon asset not found.");
    return null;
  }

  try {
    tray = new Tray(icon);
    tray.setToolTip(`${config.APP_TITLE} (Keychron Configurator)`);

    const updateContextMenu = () => {
      const contextMenu = Menu.buildFromTemplate([
        {
          label: `Open ${config.APP_TITLE}`,
          click: () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
            }
          }
        },
        { type: "separator" },
        {
          label: "Rescan Hardware Devices",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: "Reload Launcher",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reload();
            }
          }
        },
        { type: "separator" },
        {
          label: "Run in Background on Close",
          type: "checkbox",
          checked: runInBackground,
          click: (menuItem) => {
            runInBackground = menuItem.checked;
          }
        },
        ...(onCheckUpdates
          ? [
              {
                label: "Check for Updates...",
                click: onCheckUpdates
              }
            ]
          : []),
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            runInBackground = false;
            app.quit();
          }
        }
      ]);

      tray.setContextMenu(contextMenu);
    };

    updateContextMenu();

    tray.on("click", () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible()) {
        if (mainWindow.isFocused()) {
          mainWindow.hide();
        } else {
          mainWindow.focus();
        }
      } else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    return tray;
  } catch (err) {
    if (config.DEBUG) console.error("[KcLauncher:Tray] Failed to initialize tray:", err);
    return null;
  }
}

function shouldRunInBackground() {
  return runInBackground;
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  createTray,
  shouldRunInBackground,
  destroyTray
};
