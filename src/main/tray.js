"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, Tray, Menu, nativeImage, shell } = require("electron");
const config = require("./config");
const { showDeviceInspectorDialog } = require("./device-inspector");
const { openProfilesFolder, listProfiles } = require("./profile-manager");

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

function getStatusIcon(isEnabled) {
  const iconPath = path.join(
    __dirname,
    "..",
    "assets",
    "icons",
    isEnabled ? "status-enabled.png" : "status-disabled.png"
  );
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      return img.resize({ width: 16, height: 16 });
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
          label: "Reload Launcher",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.reload();
            }
          }
        },
        {
          label: "Device Diagnostics & Inspector...",
          click: () => {
            showDeviceInspectorDialog(mainWindow);
          }
        },
        {
          label: "Profiles",
          submenu: [
            {
              label: "Open Profiles Folder",
              click: () => {
                openProfilesFolder();
              }
            },
            { type: "separator" },
            ...(listProfiles().length > 0
              ? listProfiles().map((p) => ({
                  label: p.name,
                  click: () => {
                    shell.showItemInFolder(p.fullPath);
                  }
                }))
              : [
                  {
                    label: "No saved profiles yet",
                    enabled: false
                  }
                ])
          ]
        },
        { type: "separator" },
        {
          label: `Run in Background on Close (${runInBackground ? "Enabled" : "Disabled"})`,
          icon: getStatusIcon(runInBackground),
          type: "checkbox",
          checked: runInBackground,
          click: (menuItem) => {
            runInBackground = menuItem.checked !== undefined ? menuItem.checked : !runInBackground;
            updateContextMenu();
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
