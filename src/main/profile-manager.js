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

function importProfile(parentWindow) {
  const dir = getProfilesDir();
  dialog
    .showOpenDialog(parentWindow, {
      title: "Import Keychron / VIA Keymap JSON",
      properties: ["openFile"],
      filters: [{ name: "Keymap JSON (*.json)", extensions: ["json"] }]
    })
    .then(({ canceled, filePaths }) => {
      if (!canceled && filePaths.length > 0) {
        const srcPath = filePaths[0];
        const destPath = path.join(dir, path.basename(srcPath));
        fs.copyFileSync(srcPath, destPath);

        dialog.showMessageBox(parentWindow, {
          type: "info",
          title: "Profile Imported",
          message: `Imported "${path.basename(srcPath)}"`,
          detail: `Profile saved to: ${destPath}\nYou can select it from the Profiles menu anytime.`
        });
      }
    });
}

module.exports = {
  getProfilesDir,
  listProfiles,
  openProfilesFolder,
  importProfile
};
