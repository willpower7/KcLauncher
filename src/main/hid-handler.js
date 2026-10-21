"use strict";

const path = require("node:path");
const { dialog, Notification } = require("electron");
const config = require("./config");

function matchesHostPattern(hostname, pattern) {
  if (pattern.startsWith("*.")) {
    const bare = pattern.slice(2);
    return hostname === bare || hostname.endsWith(`.${bare}`);
  }
  return hostname === pattern;
}

function isAllowedOrigin(rawUrl) {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "file:") return true;
    if (parsed.protocol !== "https:") return false;

    return config.ALLOWED_HOST_PATTERNS.some((pattern) =>
      matchesHostPattern(parsed.hostname, pattern)
    );
  } catch {
    return false;
  }
}

function logDebug(tag, payload) {
  if (!config.DEBUG) return;
  console.log(`[KcLauncher:${tag}]`, payload ? JSON.stringify(payload) : "");
}

function deviceMatchesFilter(device, filters) {
  if (!filters || filters.length === 0) return true;
  return filters.some((filter) => {
    if (filter.vendorId && filter.vendorId !== device.vendorId) return false;
    if (filter.productId && filter.productId !== device.productId) return false;
    if (filter.usagePage !== undefined || filter.usage !== undefined) {
      const collections = device.collections || [];
      return collections.some((c) => {
        const pageMatch = filter.usagePage === undefined || c.usagePage === filter.usagePage;
        const usageMatch = filter.usage === undefined || c.usage === filter.usage;
        return pageMatch && usageMatch;
      });
    }
    return true;
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

    if (details.deviceType === "hid" || details.deviceType === "usb") {
      return true;
    }

    return false;
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

    if (details.frame && !isAllowedOrigin(details.frame.url)) {
      logDebug("select-hid-device:blockedOrigin", details.frame.url);
      callback("");
      return;
    }

    if (deviceList.length === 0) {
      logDebug("select-hid-device:empty");
      callback("");

      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "No Keychron Device Found",
          message: "No compatible HID device was detected.",
          detail:
            "Please ensure your Keychron keyboard or mouse is:\n" +
            " 1. Connected via USB cable (WebHID cannot configure over Bluetooth)\n" +
            " 2. Toggled to 'Cable' mode on the physical switch\n" +
            " 3. Permitted by Linux udev rules (package includes /lib/udev/rules.d/60-keychron.rules)",
          buttons: ["OK"]
        });
      }
      return;
    }

    // 1. Filter candidates matching active WebHID filter (e.g. keyboard vs mouse usagePage)
    const filterMatched = deviceList.filter((d) => deviceMatchesFilter(d, details.filters));
    const candidatePool = filterMatched.length > 0 ? filterMatched : deviceList;

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
      const buttons = keychronDevices.map((d, idx) => {
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
          buttons: buttons,
          defaultId: 0,
          cancelId: buttons.length - 1
        })
        .then((result) => {
          if (result.response < keychronDevices.length) {
            logDebug("select-hid-device:userPicked", keychronDevices[result.response]);
            callback(keychronDevices[result.response].deviceId);
          } else {
            callback("");
          }
        })
        .catch(() => {
          callback(keychronDevices[0].deviceId);
        });
      return;
    }

    // Fallback: Single candidate in pool
    if (candidatePool.length === 1) {
      logDebug("select-hid-device:singleCandidate", candidatePool[0]);
      callback(candidatePool[0].deviceId);
      return;
    }

    // Default to first candidate
    logDebug("select-hid-device:fallbackFirst", candidatePool[0]);
    callback(candidatePool[0].deviceId);
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

    if (details.frame && !isAllowedOrigin(details.frame.url)) {
      callback("");
      return;
    }

    if (deviceList.length === 0) {
      callback("");
      return;
    }

    // Prefer Keychron devices or bootloaders (STM32 DFU, RP2040, XinJi)
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

    callback(deviceList[0].deviceId);
  });

  // 5. HID Device Attached/Removed Listeners with Native Desktop Notifications
  appSession.on("hid-device-added", (event, device) => {
    logDebug("hid-device-added", {
      name: device.name,
      vendorId: device.vendorId,
      productId: device.productId
    });

    if (config.ALL_KEYCHRON_VENDORS.includes(device.vendorId) && Notification.isSupported()) {
      new Notification({
        title: "Keychron Hardware Connected",
        body: `${device.name || "Keychron Device"} is plugged in and ready to configure.`,
        icon: path.join(__dirname, "..", "assets", "icon.png"),
        silent: true
      }).show();
    }
  });

  appSession.on("hid-device-removed", (event, device) => {
    logDebug("hid-device-removed", {
      name: device.name,
      vendorId: device.vendorId,
      productId: device.productId
    });

    if (config.ALL_KEYCHRON_VENDORS.includes(device.vendorId) && Notification.isSupported()) {
      new Notification({
        title: "Keychron Hardware Disconnected",
        body: `${device.name || "Keychron Device"} was disconnected.`,
        icon: path.join(__dirname, "..", "assets", "icon.png"),
        silent: true
      }).show();
    }
  });
}

module.exports = {
  isAllowedOrigin,
  setupHidAndUsbPermissions
};
