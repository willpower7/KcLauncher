"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, shell, session, dialog } = require("electron");
const config = require("./config");
const { isAllowedOrigin, setupHidAndUsbPermissions } = require("./hid-handler");
const { buildAppMenu } = require("./menu");

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

  // Setup Menu
  buildAppMenu(mainWindow);

  // Setup WebHID and WebUSB permissions on default session
  setupHidAndUsbPermissions(session.defaultSession, mainWindow);

  // Load URL or local offline fallback
  const targetUrl = config.OFFLINE_MODE
    ? `file://${config.FALLBACK_OFFLINE_URL}`
    : config.LAUNCHER_URL;

  mainWindow.loadURL(targetUrl);

  // Gracefully show window once DOM is ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    if (config.DEVTOOLS) {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });

  // Handle load failure (e.g. offline)
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    if (config.DEBUG) {
      console.warn(`[KcLauncher] did-fail-load: ${errorCode} - ${errorDescription} on ${validatedURL}`);
    }

    // If main page failed to load (offline), redirect to local offline helper
    if (validatedURL.startsWith("https://launcher.keychron")) {
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

  // Save state on close
  mainWindow.on("close", () => {
    saveWindowState(mainWindow);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Second instance focus
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
