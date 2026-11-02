"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, session, dialog, screen } = require("electron");
const config = require("./config");
const {
  isAllowedOrigin,
  isLauncherOrigin,
  safeOpenExternal,
  setupHidAndUsbPermissions
} = require("./hid-handler");
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
const cliArgs = new Set(process.argv.slice(1));

if (cliArgs.has("-v") || cliArgs.has("--version")) {
  console.log(`KcLauncher v${app.getVersion()}`);
  process.exit(0);
}

if (cliArgs.has("-h") || cliArgs.has("--help")) {
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
  --local-mirror   Run from local mirrored assets (if present)
  --hidden         Start minimized to system tray
  --no-tray        Disable system tray icon
`);
  process.exit(0);
}

if (cliArgs.has("-d") || cliArgs.has("--debug")) {
  config.DEBUG = true;
}
if (cliArgs.has("--devtools")) {
  config.DEVTOOLS = true;
}
if (cliArgs.has("--offline")) {
  config.OFFLINE_MODE = true;
}
if (cliArgs.has("--local-mirror")) {
  config.USE_LOCAL_MIRROR = true;
}

const startHidden = cliArgs.has("--hidden");
const disableTray = cliArgs.has("--no-tray");

// Prevent multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let isQuitting = false;

function getWindowStateFilePath() {
  return path.join(app.getPath("userData"), config.WINDOW.STATE_FILE);
}

function loadWindowState() {
  try {
    const raw = fs.readFileSync(getWindowStateFilePath(), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      width: parsed.width || config.WINDOW.DEFAULT_WIDTH,
      height: parsed.height || config.WINDOW.DEFAULT_HEIGHT,
      x: parsed.x,
      y: parsed.y,
      isMaximized: Boolean(parsed.isMaximized),
      runInBackground: Boolean(parsed.runInBackground)
    };
  } catch {
    return {
      width: config.WINDOW.DEFAULT_WIDTH,
      height: config.WINDOW.DEFAULT_HEIGHT,
      isMaximized: false,
      runInBackground: false
    };
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const isMax = win.isMaximized();
    const bounds = isMax ? win.getNormalBounds() : win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: isMax,
      runInBackground: shouldRunInBackground()
    };
    fs.writeFileSync(getWindowStateFilePath(), JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    if (config.DEBUG) console.error("Failed to save window state:", err);
  }
}

function getAppIconPath() {
  const iconPath = path.join(__dirname, "..", "assets", "icon.png");
  if (fs.existsSync(iconPath)) return iconPath;
  return undefined;
}

function isNewerVersion(remoteTag, currentVersion) {
  const parseSemver = (v) =>
    v.replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const r = parseSemver(remoteTag);
  const c = parseSemver(currentVersion);
  for (let i = 0; i < 3; i++) {
    const rVal = r[i] ?? 0;
    const cVal = c[i] ?? 0;
    if (rVal > cVal) return true;
    if (rVal < cVal) return false;
  }
  return false;
}

async function checkAppUpdates({ silent = false } = {}) {
  try {
    const res = await fetch("https://api.github.com/repos/willpower7/KcLauncher/releases/latest", {
      headers: {
        "User-Agent": "KcLauncher-Desktop",
        "Accept": "application/vnd.github.v3+json"
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      if (!silent && config.DEBUG) console.warn("Update check status:", res.status);
      return;
    }

    const release = await res.json();
    const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;

    if (release.tag_name && isNewerVersion(release.tag_name, app.getVersion())) {
      const { response } = await dialog.showMessageBox(win, {
        type: "info",
        title: "Update Available",
        message: `KcLauncher ${release.tag_name} is available!`,
        detail: `You are currently running v${app.getVersion()}.\n\nA new release is available with bug fixes and updates.`,
        buttons: ["View on GitHub", "Later"],
        defaultId: 0
      });

      if (response === 0) {
        const targetUrl =
          typeof release.html_url === "string" &&
          release.html_url.startsWith("https://github.com/willpower7/KcLauncher")
            ? release.html_url
            : "https://github.com/willpower7/KcLauncher/releases";
        safeOpenExternal(targetUrl);
      }
    } else if (!silent) {
      await dialog.showMessageBox(win, {
        type: "info",
        title: "Check for Updates",
        message: "You're up to date!",
        detail: `KcLauncher v${app.getVersion()} is currently the newest version.`
      });
    }
  } catch (err) {
    if (!silent) {
      const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
      await dialog.showMessageBox(win, {
        type: "warning",
        title: "Update Check",
        message: "Could not check for updates.",
        detail: err.message
      });
    }
  }
}

function initAutoUpdater() {
  if (!app.isPackaged) return;
  checkAppUpdates({ silent: true }).catch(() => {});
}

function manualCheckForUpdates() {
  checkAppUpdates({ silent: false }).catch(() => {});
}

function createMainWindow() {
  const windowState = loadWindowState();

  // Validate saved coordinates against active display bounds
  if (typeof windowState.x === "number" && typeof windowState.y === "number") {
    const displays = screen.getAllDisplays();
    const isVisible = displays.some((display) => {
      const { x, y, width, height } = display.bounds;
      return (
        windowState.x >= x &&
        windowState.x < x + width &&
        windowState.y >= y &&
        windowState.y < y + height
      );
    });
    if (!isVisible) {
      delete windowState.x;
      delete windowState.y;
    }
  }

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
      sandbox: true,
      webSecurity: true,
      spellcheck: false
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Setup Menu & Tray
  buildAppMenu(mainWindow, manualCheckForUpdates);

  if (!disableTray) {
    createTray(mainWindow, manualCheckForUpdates, windowState.runInBackground, () => {
      saveWindowState(mainWindow);
    });
  }

  // Setup WebHID and WebUSB permissions on default session
  setupHidAndUsbPermissions(session.defaultSession, mainWindow);

  // Load URL, local mirrored offline build, or fallback
  mainWindow.loadURL(config.getHomeUrl());

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
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // Ignore aborted navigations or non-top-level frame failures
    if (errorCode === -3 || !isMainFrame) return;

    if (config.DEBUG) {
      console.warn(`[KcLauncher] did-fail-load: ${errorCode} - ${errorDescription} on ${validatedURL}`);
    }

    if (validatedURL && validatedURL.startsWith("https://launcher.keychron")) {
      if (fs.existsSync(config.MIRRORED_LOCAL_URL)) {
        mainWindow.loadFile(config.MIRRORED_LOCAL_URL);
      } else {
        mainWindow.loadFile(config.FALLBACK_OFFLINE_URL);
      }
    }
  });

  // Handle external links (open in user's default browser with strict scheme validation)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isLauncherOrigin(url)) {
      mainWindow.loadURL(url);
    } else {
      safeOpenExternal(url);
    }
    return { action: "deny" };
  });

  // Navigation guard (only allow official launcher origins or vetted offline files)
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isLauncherOrigin(url) || isAllowedOrigin(url)) {
      return;
    }
    event.preventDefault();
    safeOpenExternal(url);
  });

  // Save state on close & check background daemon setting
  mainWindow.on("close", (event) => {
    saveWindowState(mainWindow);

    if (!isQuitting && shouldRunInBackground()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Defense-in-depth: Block unauthorized <webview> attachments
app.on("web-contents-created", (event, contents) => {
  contents.on("will-attach-webview", (webviewEvent) => {
    webviewEvent.preventDefault();
    if (config.DEBUG) console.warn("[Security] Prevented unauthorized <webview> creation");
  });
});

// Second instance focus
app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
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
  isQuitting = true;
  destroyTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !shouldRunInBackground()) {
    app.quit();
  }
});
