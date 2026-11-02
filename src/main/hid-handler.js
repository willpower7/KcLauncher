"use strict";

const path = require("node:path");
const { dialog, Notification, shell } = require("electron");
const config = require("./config");

const recentNotifications = new Map();

function logDebug(tag, payload) {
  if (!config.DEBUG) return;
  console.log(`[KcLauncher:${tag}]`, payload ? JSON.stringify(payload) : "");
}

function safeOpenExternal(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:" || (config.DEBUG && parsed.protocol === "http:")) {
      shell.openExternal(parsed.href).catch((err) => {
        if (config.DEBUG) console.error("[Security] Error opening external URL:", err);
      });
    } else if (config.DEBUG) {
      console.warn("[Security] Blocked non-https external URL protocol:", rawUrl);
    }
  } catch (err) {
    if (config.DEBUG) console.warn("[Security] Failed to parse external URL:", err);
  }
}

function matchesHostPattern(hostname, pattern) {
  if (!hostname || !pattern || typeof hostname !== "string" || typeof pattern !== "string") {
    return false;
  }
  const cleanHost = hostname.toLowerCase();
  const cleanPattern = pattern.toLowerCase();
  if (cleanPattern.startsWith("*.")) {
    const bare = cleanPattern.slice(2);
    return cleanHost === bare || cleanHost.endsWith(`.${bare}`);
  }
  return cleanHost === cleanPattern;
}

function isAllowedOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") {
      const normalizedPath = path.normalize(decodeURIComponent(parsed.pathname));
      const allowedPaths = [
        path.normalize(config.FALLBACK_OFFLINE_URL),
        path.normalize(config.MIRRORED_LOCAL_URL),
        "/opt/Keychron/offline.html",
        "/opt/Keychron Launcher/offline.html"
      ];
      return allowedPaths.includes(normalizedPath);
    }
    if (parsed.protocol !== "https:") return false;

    return config.ALLOWED_HOST_PATTERNS.some((pattern) =>
      matchesHostPattern(parsed.hostname, pattern)
    );
  } catch {
    return false;
  }
}

function isLauncherOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") {
      return isAllowedOrigin(rawUrl);
    }
    if (parsed.protocol !== "https:") return false;
    return config.LAUNCHER_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function deviceMatchesFilter(device, filters) {
  if (!filters || filters.length === 0) return true;
  return filters.some((filter) => {
    if (filter.vendorId && filter.vendorId !== device.vendorId) return false;
    if (filter.productId && filter.productId !== device.productId) return false;
    if (device.collections && Array.isArray(device.collections) && (filter.usagePage !== undefined || filter.usage !== undefined)) {
      return device.collections.some((c) => {
        const pageMatch = filter.usagePage === undefined || c.usagePage === filter.usagePage;
        const usageMatch = filter.usage === undefined || c.usage === filter.usage;
        return pageMatch && usageMatch;
      });
    }
    return true;
  });
}

function showDeviceNotification(key, title, body) {
  if (!Notification.isSupported()) return;
  const now = Date.now();
  const lastTime = recentNotifications.get(key) || 0;
  if (now - lastTime < 2500) return;
  recentNotifications.set(key, now);
  try {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, "..", "assets", "icon.png"),
      silent: true
    }).show();
  } catch (err) {
    logDebug("NotificationError", err);
  }
}

function showNoDeviceDialog(parentWindow) {
  if (!parentWindow || parentWindow.isDestroyed()) return;
  dialog.showMessageBox(parentWindow, {
    type: "info",
    title: "No Keychron Device Found",
    message: "No compatible Keychron HID device was detected.",
    detail:
      "Please ensure your Keychron keyboard or mouse is:\n" +
      " 1. Connected via USB cable (WebHID cannot configure over Bluetooth)\n" +
      " 2. Toggled to 'Cable' mode on the physical switch\n" +
      " 3. Permitted by Linux udev rules (package includes /lib/udev/rules.d/60-keychron.rules)",
    buttons: ["OK"]
  });
}

function setupHidAndUsbPermissions(appSession, mainWindow) {
  // 1. Permission Check Handler for HID and USB
  appSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    logDebug("PermissionCheck", { permission, requestingOrigin });

    if (permission !== "hid" && permission !== "usb") {
      return false;
    }

    if (!isAllowedOrigin(requestingOrigin)) {
      logDebug("PermissionCheck:BlockedOrigin", requestingOrigin);
      return false;
    }

    if (details && details.securityOrigin && !isAllowedOrigin(details.securityOrigin)) {
      logDebug("PermissionCheck:BlockedSecurityOrigin", details.securityOrigin);
      return false;
    }

    return true;
  });

  // 2. Device Permission Handler
  appSession.setDevicePermissionHandler((details) => {
    if (!isAllowedOrigin(details.origin)) {
      return false;
    }

    return details.deviceType === "hid" || details.deviceType === "usb";
  });

  // 3. WebHID Device Picker Selection Handler
  appSession.on("select-hid-device", (event, details, callback) => {
    event.preventDefault();

    const deviceList = (details && details.deviceList) || [];
    logDebug("select-hid-device:candidates", {
      count: deviceList.length,
      filters: details.filters,
      devices: deviceList.map((d) => ({
        name: d.name,
        vendorId: d.vendorId,
        productId: d.productId,
        deviceId: d.deviceId
      }))
    });

    const frameUrl = details.frame?.url || event.senderFrame?.url || (event.sender?.getURL && event.sender.getURL());
    if (!frameUrl || !isAllowedOrigin(frameUrl)) {
      logDebug("select-hid-device:blockedOrigin", frameUrl);
      callback();
      return;
    }

    if (deviceList.length === 0) {
      logDebug("select-hid-device:empty");
      callback();
      showNoDeviceDialog(mainWindow);
      return;
    }

    // 1. Filter candidates matching active WebHID filter (e.g. keyboard vs mouse usagePage)
    const filterMatched = deviceList.filter((d) => deviceMatchesFilter(d, details.filters));
    const candidatePool = (details.filters && details.filters.length > 0) ? filterMatched : deviceList;

    // 2. Identify all Keychron / Lemokey / XinJi devices
    const keychronDevices = candidatePool.filter((d) =>
      config.ALL_KEYCHRON_VENDORS.includes(d.vendorId)
    );

    // If exactly one Keychron device matches, auto-connect it immediately
    if (keychronDevices.length === 1) {
      logDebug("select-hid-device:autoSingleKeychron", keychronDevices[0]);
      callback(keychronDevices[0].deviceId);
      return;
    }

    // If multiple Keychron devices are connected, show a native device selection dialog
    if (keychronDevices.length > 1 && mainWindow && !mainWindow.isDestroyed()) {
      const buttons = keychronDevices.map((d) => {
        const hexPid = d.productId ? ` [0x${d.productId.toString(16).padStart(4, "0")}]` : "";
        return `${d.name || "Keychron Device"}${hexPid}`;
      });
      buttons.push("Cancel");

      dialog
        .showMessageBox(mainWindow, {
          type: "question",
          title: "Select Keychron Device",
          message: "Multiple Keychron devices were detected:",
          detail: "Please choose which device you want to connect to Keychron Launcher:",
          buttons,
          defaultId: 0,
          cancelId: buttons.length - 1
        })
        .then((result) => {
          if (result.response < keychronDevices.length) {
            logDebug("select-hid-device:userPicked", keychronDevices[result.response]);
            callback(keychronDevices[result.response].deviceId);
          } else {
            callback();
          }
        })
        .catch(() => {
          callback();
        });
      return;
    }

    // If no Keychron devices are detected in the candidate pool, refuse auto-connection to foreign devices
    logDebug("select-hid-device:noMatchingKeychron");
    callback();
    showNoDeviceDialog(mainWindow);
  });

  // 4. WebUSB Device Picker Selection Handler (DFU / Firmware flashing)
  appSession.on("select-usb-device", (event, details, callback) => {
    event.preventDefault();

    const deviceList = (details && details.deviceList) || [];
    logDebug("select-usb-device:candidates", {
      count: deviceList.length,
      devices: deviceList.map((d) => ({
        name: d.productName,
        vendorId: d.vendorId,
        productId: d.productId
      }))
    });

    const frameUrl = details.frame?.url || event.senderFrame?.url || (event.sender?.getURL && event.sender.getURL());
    if (!frameUrl || !isAllowedOrigin(frameUrl)) {
      logDebug("select-usb-device:blockedOrigin", frameUrl);
      callback();
      return;
    }

    if (deviceList.length === 0) {
      callback();
      return;
    }

    // Only allow Keychron devices or bootloaders (STM32 DFU, RP2040)
    const matched = deviceList.find(
      (d) =>
        config.ALL_KEYCHRON_VENDORS.includes(d.vendorId) ||
        config.ALL_BOOTLOADER_VENDORS.includes(d.vendorId)
    );

    if (matched) {
      logDebug("select-usb-device:selected", matched);
      callback(matched.deviceId);
      return;
    }

    // Security hardening: Deny raw WebUSB access to non-Keychron / foreign USB devices
    logDebug("select-usb-device:deniedNonKeychron");
    callback();
  });

  // 5. HID Device Attached/Removed Listeners with Throttled Desktop Notifications
  appSession.on("hid-device-added", (event, details) => {
    const device = (details && details.device) || details;
    if (!device) return;
    logDebug("hid-device-added", {
      name: device.name,
      vendorId: device.vendorId,
      productId: device.productId
    });

    if (config.ALL_KEYCHRON_VENDORS.includes(device.vendorId)) {
      showDeviceNotification(
        `add:${device.vendorId}:${device.productId}`,
        "Keychron Hardware Connected",
        `${device.name || "Keychron Device"} is plugged in and ready to configure.`
      );
    }
  });

  appSession.on("hid-device-removed", (event, details) => {
    const device = (details && details.device) || details;
    if (!device) return;
    logDebug("hid-device-removed", {
      name: device.name,
      vendorId: device.vendorId,
      productId: device.productId
    });

    if (config.ALL_KEYCHRON_VENDORS.includes(device.vendorId)) {
      showDeviceNotification(
        `remove:${device.vendorId}:${device.productId}`,
        "Keychron Hardware Disconnected",
        `${device.name || "Keychron Device"} was disconnected.`
      );
    }
  });
}

module.exports = {
  matchesHostPattern,
  isAllowedOrigin,
  isLauncherOrigin,
  deviceMatchesFilter,
  safeOpenExternal,
  setupHidAndUsbPermissions
};
