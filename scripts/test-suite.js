#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
let failures = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failures++;
  }
}

console.log("=== KcLauncher Test Suite ===");

// 1. Check JavaScript Syntax
console.log("\n[1/5] Validating JavaScript syntax...");
const jsFiles = [
  "src/main/index.js",
  "src/main/hid-handler.js",
  "src/main/menu.js",
  "src/main/config.js",
  "src/main/tray.js",
  "src/main/preload.js",
  "src/renderer/offline.js"
];

for (const file of jsFiles) {
  const fullPath = path.join(ROOT, file);
  try {
    execSync(`node -c "${fullPath}"`);
    assert(true, `${file} syntax valid`);
  } catch (err) {
    assert(false, `${file} syntax error: ${err.message}`);
  }
}

// 2. Check Required Files & Assets
console.log("\n[2/5] Checking required project files and assets...");
const requiredFiles = [
  "package.json",
  "LICENSE",
  "README.md",
  "build/electron-builder.yml",
  "build/udev/60-keychron.rules",
  "build/debian/postinst",
  "build/debian/postrm",
  "build/debian/kclauncher.desktop",
  "build/debian/com.willpower7.kclauncher.metainfo.xml",
  "src/assets/icon.png",
  "src/assets/icon.svg",
  "src/assets/icons/64x64.png",
  "src/assets/icons/128x128.png",
  "src/assets/icons/256x256.png",
  "src/assets/icons/512x512.png",
  "src/renderer/offline.html",
  "src/renderer/offline.css"
];

for (const file of requiredFiles) {
  const exists = fs.existsSync(path.join(ROOT, file));
  assert(exists, `Required file exists: ${file}`);
}

// 3. Check udev Rules Content
console.log("\n[3/5] Verifying udev rules format and vendor IDs...");
const udevContent = fs.readFileSync(path.join(ROOT, "build/udev/60-keychron.rules"), "utf-8");
assert(udevContent.includes("3434"), "Rules match Keychron VID 0x3434");
assert(udevContent.includes("34b7"), "Rules match XinJi/Mice VID 0x34b7");
assert(udevContent.includes("0483"), "Rules match STM32 DFU 0x0483");
assert(udevContent.includes("2e8a"), "Rules match RP2040 DFU 0x2e8a");
assert(udevContent.includes('TAG+="uaccess"'), "Rules contain systemd uaccess tag");

// 4. Privacy & Path Hygiene Check
console.log("\n[4/5] Checking for hardcoded user paths in source and docs...");
const checkDirs = ["src", "build", "docs", "scripts"];
let foundHardcodedPaths = false;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else if (entry.isFile() && !entry.name.endsWith(".png") && !entry.name.endsWith(".ico") && entry.name !== "test-suite.js") {
      const forbiddenUser = "/home" + "/willi";
      const forbiddenMac = "/Users" + "/";
      const content = fs.readFileSync(full, "utf-8");
      if (content.includes(forbiddenUser) || content.includes(forbiddenMac)) {
        console.error(`  ✗ Found hardcoded path in: ${full}`);
        foundHardcodedPaths = true;
      }
    }
  }
}

for (const d of checkDirs) {
  scanDir(path.join(ROOT, d));
}
assert(!foundHardcodedPaths, "Zero hardcoded personal paths found");

// 5. Package.json Integrity
console.log("\n[5/5] Checking package.json metadata...");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8"));
assert(pkg.name === "kclauncher", "Package name is kclauncher");
assert(Boolean(pkg.version), `Package version defined (${pkg.version})`);
assert(pkg.license === "MIT", "License is MIT");
assert(pkg.main === "src/main/index.js", "Entry point is src/main/index.js");

console.log("\n=============================");
if (failures === 0) {
  console.log("✓ All checks passed! 100% test success.\n");
  process.exit(0);
} else {
  console.error(`✗ ${failures} check(s) failed.\n`);
  process.exit(1);
}
