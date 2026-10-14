"use strict";

const { dialog } = require("electron");
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
      devices: deviceList.map((d) => ({
        name: d.name,
        vendorId: d.vendorId,
        productId: d.productId,
        deviceId: d.deviceId
      }))
    });

    if (details.frame && !isAllowedOrigin(details.frame.url)) {
      logDebug("select-hid-device:blocked", details.frame.url);
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

    // Prioritize Keychron devices (Vendor ID 0x3434 / 13364)
    const keychronDevice = deviceList.find(
      (device) => device.vendorId === config.VENDOR_IDS.KEYCHRON
    );

    if (keychronDevice) {
      logDebug("select-hid-device:selectedKeychron", {
        name: keychronDevice.name,
        vendorId: keychronDevice.vendorId,
        productId: keychronDevice.productId
      });
      callback(keychronDevice.deviceId);
      return;
    }

    // Fallback: If only one HID device candidate is present, select it
    if (deviceList.length === 1) {
      logDebug("select-hid-device:singleCandidate", deviceList[0]);
      callback(deviceList[0].deviceId);
      return;
    }

    // Default to first device if multiple non-Keychron devices found
    callback(deviceList[0].deviceId);
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

    // Prefer Keychron or STM32 / RP2040 bootloader
    const matched = deviceList.find(
      (d) =>
        d.vendorId === config.VENDOR_IDS.KEYCHRON ||
        d.vendorId === config.VENDOR_IDS.STM32_DFU ||
        d.vendorId === config.VENDOR_IDS.RP2040_BOOTLOADER
    );

    if (matched) {
      logDebug("select-usb-device:selected", matched);
      callback(matched.deviceId);
      return;
    }

    callback(deviceList[0].deviceId);
  });

  // 5. HID Device Attached/Removed Listeners
  appSession.on("hid-device-added", (event, device) => {
    logDebug("hid-device-added", {
      name: device.name,
      vendorId: device.vendorId,
      productId: device.productId
    });
  });

  appSession.on("hid-device-removed", (event, device) => {
    logDebug("hid-device-removed", {
      name: device.name,
      vendorId: device.vendorId,
      productId: device.productId
    });
  });
}

module.exports = {
  isAllowedOrigin,
  setupHidAndUsbPermissions
};
