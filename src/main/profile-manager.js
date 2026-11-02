"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, shell, dialog } = require("electron");
const config = require("./config");

const MAX_PROFILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getProfilesDir() {
  const dir = path.join(app.getPath("userData"), config.PROFILES_DIR_NAME || "profiles");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const readmeContent = [
        "KcLauncher Profiles Directory",
        "==============================",
        "",
        "Save your custom Keychron / VIA layout JSON backups in this folder.",
        "Profiles saved here are listed in KcLauncher's System Tray and Application Menu.",
        "",
        "How to backup from Keychron Launcher:",
        "1. Open Keychron Launcher in KcLauncher.",
        "2. Go to Keymap / Layout tab.",
        "3. Export your keymap JSON and save it in this directory.",
        ""
      ].join("\n");
      fs.writeFileSync(path.join(dir, "README.txt"), readmeContent, "utf-8");
    } catch (err) {
      if (config.DEBUG) console.error("Failed to initialize profiles directory:", err);
    }
  }
  return dir;
}

function listProfiles() {
  const dir = getProfilesDir();
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((dirent) => dirent.isFile() && dirent.name.endsWith(".json") && !dirent.name.startsWith("."))
      .map((dirent) => ({
        name: path.basename(dirent.name, ".json"),
        filename: dirent.name,
        fullPath: path.join(dir, dirent.name)
      }));
  } catch {
    return [];
  }
}

function openProfilesFolder() {
  const dir = getProfilesDir();
  shell.openPath(dir).catch((err) => {
    if (config.DEBUG) console.error("Failed to open profiles folder:", err);
  });
}

function sanitizeProfileFilename(rawFilename) {
  if (!rawFilename || typeof rawFilename !== "string") {
    return `profile_${Date.now()}.json`;
  }
  let base = path.basename(rawFilename).trim();
  // Strip dangerous traversal characters and leading dots (prevent hidden files)
  base = base.replace(/^\.+/, "");
  // Replace unsafe characters
  let sanitized = base.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim();
  // Strip trailing .json if present to get clean stem
  if (sanitized.toLowerCase().endsWith(".json")) {
    sanitized = sanitized.slice(0, -5).trim();
  }
  if (!sanitized) {
    sanitized = `profile_${Date.now()}`;
  }
  // Enforce max length
  if (sanitized.length > 64) {
    sanitized = sanitized.slice(0, 64);
  }
  return `${sanitized}.json`;
}

function importProfile(parentWindow) {
  const win = parentWindow && !parentWindow.isDestroyed() ? parentWindow : null;
  const dir = getProfilesDir();

  dialog
    .showOpenDialog(win, {
      title: "Import Keychron / VIA Keymap JSON",
      properties: ["openFile"],
      filters: [{ name: "Keymap JSON (*.json)", extensions: ["json"] }]
    })
    .then(async ({ canceled, filePaths }) => {
      if (canceled || !filePaths || filePaths.length === 0) return;
      const srcPath = filePaths[0];

      try {
        const stats = await fs.promises.stat(srcPath);
        if (stats.size > MAX_PROFILE_SIZE) {
          dialog.showMessageBox(win, {
            type: "error",
            title: "File Too Large",
            message: "The selected profile file exceeds the 5MB size limit."
          });
          return;
        }

        const rawContent = await fs.promises.readFile(srcPath, "utf-8");
        const parsed = JSON.parse(rawContent);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Profile must contain a JSON object or array.");
        }

        const safeFilename = sanitizeProfileFilename(path.basename(srcPath));
        const destPath = path.resolve(dir, safeFilename);

        if (!destPath.startsWith(path.resolve(dir) + path.sep)) {
          throw new Error("Invalid profile destination path.");
        }

        await fs.promises.writeFile(destPath, JSON.stringify(parsed, null, 2), "utf-8");

        dialog.showMessageBox(win, {
          type: "info",
          title: "Profile Imported",
          message: `Imported "${safeFilename}"`,
          detail: `Profile saved to: ${destPath}\nYou can select it from the Profiles menu anytime.`
        });
      } catch (err) {
        if (config.DEBUG) console.error("Failed to import profile:", err);
        dialog.showMessageBox(win, {
          type: "error",
          title: "Import Failed",
          message: "Could not import profile file.",
          detail: err.message
        });
      }
    })
    .catch((err) => {
      if (config.DEBUG) console.error("Open dialog error:", err);
    });
}

module.exports = {
  getProfilesDir,
  listProfiles,
  openProfilesFolder,
  sanitizeProfileFilename,
  importProfile
};
