"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, shell, session, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const config = require("./config");
const { isAllowedOrigin, setupHidAndUsbPermissions } = require("./hid-handler");
const { buildAppMenu } = require("./menu");
const { createTray, shouldRunInBackground, destroyTray } = require("./tray");

// Linux Wayland & Display Server Compatibility
if (process.platform === "linux") {
  app.commandLine.appendSwitch("ozone-platform-hint", "auto");
  app.commandLine.appendSwitch("enable-features", "WaylandWindowDecorations");
}

app.setName("Keychron Launcher");
app.setAppUserModelId("com.willpower7.kclauncher");

// Parse Command Line Arguments
const cliArgs = process.argv.slice(1);

if (cliArgs.includes("-v") || cliArgs.includes("--version")) {
  console.log(`KcLauncher v${app.getVersion()}`);
  process.exit(0);
}

if (cliArgs.includes("-h") || cliArgs.includes("--help")) {
  console.log(`
KcLauncher v${app.getVersion()}
Native Linux desktop application port of Keychron Launcher

Usage:
  kclauncher [options]

Options:
  -v, --version    Show version information and exit
  -h, --help       Show this help message and exit
  -d, --debug      Enable verbose debug logging
  --devtools       Open Chromium Developer Tools on launch
  --offline        Force offline diagnostic fallback mode
  --hidden         Start minimized to system tray
  --no-tray        Disable system tray icon
`);
  process.exit(0);
}

if (cliArgs.includes("-d") || cliArgs.includes("--debug")) {
  config.DEBUG = true;
}
if (cliArgs.includes("--devtools")) {
  config.DEVTOOLS = true;
}
if (cliArgs.includes("--offline")) {
  config.OFFLINE_MODE = true;
}

const startHidden = cliArgs.includes("--hidden");
const disableTray = cliArgs.includes("--no-tray");

// Prevent multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;

function getWindowStateFilePath() {
  return path.join(app.getPath("userData"), config.WINDOW.STATE_FILE);
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(getWindowStateFilePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      width: config.WINDOW.DEFAULT_WIDTH,
      height: config.WINDOW.DEFAULT_HEIGHT,
      isMaximized: false
    };
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized()
    };
    fs.writeFileSync(getWindowStateFilePath(), JSON.stringify(state), "utf-8");
  } catch (err) {
    if (config.DEBUG) console.error("Failed to save window state:", err);
  }
}

function getAppIconPath() {
  const iconPath = path.join(__dirname, "..", "assets", "icon.png");
  if (fs.existsSync(iconPath)) return iconPath;
  return undefined;
}

function initAutoUpdater() {
  if (!app.isPackaged) return;

  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info) => {
      dialog.showMessageBox({
        type: "info",
        title: "Update Available",
        message: `KcLauncher v${info.version} is available.`,
        detail: "The update is downloading in the background and will install when you restart the app."
      });
    });

    autoUpdater.checkForUpdates().catch((err) => {
      if (config.DEBUG) console.warn("[KcLauncher:Updater] Update check failed:", err.message);
    });
  } catch (err) {
    if (config.DEBUG) console.warn("[KcLauncher:Updater] Failed to initialize updater:", err);
  }
}

function manualCheckForUpdates() {
  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Check for Updates",
      message: "Development Mode Active",
      detail: "Update checks against GitHub Releases are active in packaged builds."
    });
    return;
  }

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      if (!result || !result.updateInfo) {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Check for Updates",
          message: "You're up to date!",
          detail: `KcLauncher v${app.getVersion()} is currently the newest version.`
        });
      }
    })
    .catch((err) => {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Update Check",
        message: "Could not reach update server.",
        detail: err.message
      });
    });
}

function createMainWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    title: config.APP_TITLE,
    x: windowState.x,
    y: windowState.y,
    width: windowState.width || config.WINDOW.DEFAULT_WIDTH,
    height: windowState.height || config.WINDOW.DEFAULT_HEIGHT,
    minWidth: config.WINDOW.MIN_WIDTH,
    minHeight: config.WINDOW.MIN_HEIGHT,
    icon: getAppIconPath(),
    backgroundColor: "#181a1f",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for WebHID hardware access in Electron
      spellcheck: false
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Setup Menu & Tray
  buildAppMenu(mainWindow, manualCheckForUpdates);

  if (!disableTray) {
    createTray(mainWindow, manualCheckForUpdates);
  }

  // Setup WebHID and WebUSB permissions on default session
  setupHidAndUsbPermissions(session.defaultSession, mainWindow);

  // Load URL or local offline fallback
  const targetUrl = config.OFFLINE_MODE
    ? `file://${config.FALLBACK_OFFLINE_URL}`
    : config.LAUNCHER_URL;

  mainWindow.loadURL(targetUrl);

  // Show window once DOM is ready (unless starting hidden)
  mainWindow.once("ready-to-show", () => {
    if (!startHidden) {
      mainWindow.show();
    }
    if (config.DEVTOOLS) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  // Handle load failure (e.g. offline)
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    if (config.DEBUG) {
      console.warn(`[KcLauncher] did-fail-load: ${errorCode} - ${errorDescription} on ${validatedURL}`);
    }

    if (validatedURL && validatedURL.startsWith("https://launcher.keychron")) {
      mainWindow.loadFile(config.FALLBACK_OFFLINE_URL);
    }
  });

  // Handle external links (open in user's default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedOrigin(url)) {
      mainWindow.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Navigation guard
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedOrigin(url) && !url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Save state on close & check background daemon setting
  mainWindow.on("close", (event) => {
    saveWindowState(mainWindow);

    if (shouldRunInBackground()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Second instance focus
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();
  initAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  destroyTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !shouldRunInBackground()) {
    app.quit();
  }
});
