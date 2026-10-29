"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, shell, dialog } = require("electron");
const config = require("./config");

function getProfilesDir() {
  const dir = path.join(app.getPath("userData"), config.PROFILES_DIR_NAME || "profiles");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // Write an informative README.txt in the folder
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
  }
  return dir;
}

function listProfiles() {
  const dir = getProfilesDir();
  try {
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => ({
        name: path.basename(file, ".json"),
        filename: file,
        fullPath: path.join(dir, file)
      }));
  } catch {
    return [];
  }
}

function openProfilesFolder() {
  const dir = getProfilesDir();
  shell.openPath(dir);
}

const MAX_PROFILE_SIZE = 5 * 1024 * 1024; // 5 MB

function sanitizeProfileFilename(rawFilename) {
  const base = path.basename(rawFilename).trim();
  // Strip non-alphanumeric/safe characters, preventing traversal or hidden files
  const sanitized = base.replace(/[^a-zA-Z0-9_\-. ]/g, "_");
  if (!sanitized.toLowerCase().endsWith(".json")) {
    return `${sanitized}.json`;
  }
  return sanitized;
}

function importProfile(parentWindow) {
  const dir = getProfilesDir();
  dialog
    .showOpenDialog(parentWindow, {
      title: "Import Keychron / VIA Keymap JSON",
      properties: ["openFile"],
      filters: [{ name: "Keymap JSON (*.json)", extensions: ["json"] }]
    })
    .then(({ canceled, filePaths }) => {
      if (canceled || !filePaths || filePaths.length === 0) return;
      const srcPath = filePaths[0];

      try {
        const stats = fs.statSync(srcPath);
        if (stats.size > MAX_PROFILE_SIZE) {
          dialog.showMessageBox(parentWindow, {
            type: "error",
            title: "File Too Large",
            message: "The selected profile file exceeds the 5MB size limit."
          });
          return;
        }

        const rawContent = fs.readFileSync(srcPath, "utf-8");
        const parsed = JSON.parse(rawContent);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Profile must contain a JSON object or array.");
        }

        const safeFilename = sanitizeProfileFilename(path.basename(srcPath));
        const destPath = path.resolve(dir, safeFilename);

        if (!destPath.startsWith(path.resolve(dir) + path.sep)) {
          throw new Error("Invalid profile destination path.");
        }

        fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), "utf-8");

        dialog.showMessageBox(parentWindow, {
          type: "info",
          title: "Profile Imported",
          message: `Imported "${safeFilename}"`,
          detail: `Profile saved to: ${destPath}\nYou can select it from the Profiles menu anytime.`
        });
      } catch (err) {
        if (config.DEBUG) console.error("Failed to import profile:", err);
        dialog.showMessageBox(parentWindow, {
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
  importProfile
};
