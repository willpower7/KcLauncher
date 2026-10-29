"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, shell, session, dialog, screen } = require("electron");
const https = require("node:https");
const config = require("./config");
const { isAllowedOrigin, isLauncherOrigin, setupHidAndUsbPermissions } = require("./hid-handler");
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
  --local-mirror   Run from local mirrored assets (if present)
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
if (cliArgs.includes("--local-mirror")) {
  config.USE_LOCAL_MIRROR = true;
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
let isQuitting = false;

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

function safeOpenExternal(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      shell.openExternal(parsed.href);
    } else if (config.DEBUG) {
      console.warn("[Security] Blocked non-http(s) external URL protocol:", rawUrl);
    }
  } catch (err) {
    if (config.DEBUG) console.warn("[Security] Failed to parse external URL:", err);
  }
}

function isNewerVersion(remoteTag, currentVersion) {
  const cleanRemote = remoteTag.replace(/^v/, "").split(".").map(Number);
  const cleanCurrent = currentVersion.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const r = cleanRemote[i] || 0;
    const c = cleanCurrent[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

function checkAppUpdates({ silent = false } = {}) {
  const req = https.get(
    "https://api.github.com/repos/willpower7/KcLauncher/releases/latest",
    { headers: { "User-Agent": "KcLauncher-Desktop" } },
    (res) => {
      if (res.statusCode !== 200) {
        if (!silent && config.DEBUG) console.warn("Update check status:", res.statusCode);
        return;
      }
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          const release = JSON.parse(raw);
          if (release.tag_name && isNewerVersion(release.tag_name, app.getVersion())) {
            dialog
              .showMessageBox(mainWindow, {
                type: "info",
                title: "Update Available",
                message: `KcLauncher ${release.tag_name} is available!`,
                detail: `You are currently running v${app.getVersion()}.\n\nA new release is available with bug fixes and updates.`,
                buttons: ["View on GitHub", "Later"],
                defaultId: 0
              })
              .then(({ response }) => {
                if (response === 0) {
                  const targetUrl =
                    typeof release.html_url === "string" &&
                    release.html_url.startsWith("https://github.com/willpower7/KcLauncher")
                      ? release.html_url
                      : "https://github.com/willpower7/KcLauncher/releases";
                  safeOpenExternal(targetUrl);
                }
              });
          } else if (!silent) {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Check for Updates",
              message: "You're up to date!",
              detail: `KcLauncher v${app.getVersion()} is currently the newest version.`
            });
          }
        } catch (err) {
          if (!silent) {
            dialog.showMessageBox(mainWindow, {
              type: "warning",
              title: "Update Check",
              message: "Could not parse update response.",
              detail: err.message
            });
          }
        }
      });
    }
  );

  req.on("error", (err) => {
    if (!silent) {
      dialog.showMessageBox(mainWindow, {
        type: "warning",
        title: "Update Check",
        message: "Could not reach update server.",
        detail: err.message
      });
    }
  });
}

function initAutoUpdater() {
  if (!app.isPackaged) return;
  checkAppUpdates({ silent: true });
}

function manualCheckForUpdates() {
  checkAppUpdates({ silent: false });
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

  // Load URL, local mirrored offline build, or fallback
  let targetUrl = config.LAUNCHER_URL;

  if (config.OFFLINE_MODE) {
    targetUrl = `file://${config.FALLBACK_OFFLINE_URL}?forced=1`;
  } else if (config.USE_LOCAL_MIRROR && fs.existsSync(config.MIRRORED_LOCAL_URL)) {
    targetUrl = `file://${config.MIRRORED_LOCAL_URL}`;
  }

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
  isQuitting = true;
  destroyTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !shouldRunInBackground()) {
    app.quit();
  }
});
