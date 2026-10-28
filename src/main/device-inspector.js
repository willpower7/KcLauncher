"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { dialog } = require("electron");
const config = require("./config");

function inspectHardware() {
  const devices = [];
  const usbDir = "/sys/bus/usb/devices";

  if (fs.existsSync(usbDir)) {
    try {
      const entries = fs.readdirSync(usbDir);
      for (const dev of entries) {
        const devPath = path.join(usbDir, dev);
        try {
          const idVendorRaw = fs.readFileSync(path.join(devPath, "idVendor"), "utf-8").trim();
          const idProductRaw = fs.readFileSync(path.join(devPath, "idProduct"), "utf-8").trim();
          const vendorNum = parseInt(idVendorRaw, 16);

          if (
            config.ALL_KEYCHRON_VENDORS.includes(vendorNum) ||
            config.ALL_BOOTLOADER_VENDORS.includes(vendorNum)
          ) {
            let product = "Keychron Device";
            try {
              product = fs.readFileSync(path.join(devPath, "product"), "utf-8").trim();
            } catch {}

            let manufacturer = "";
            try {
              manufacturer = fs.readFileSync(path.join(devPath, "manufacturer"), "utf-8").trim();
            } catch {}

            devices.push({
              busId: dev,
              vendorId: `0x${idVendorRaw}`,
              productId: `0x${idProductRaw}`,
              product,
              manufacturer: manufacturer || "Keychron",
              isBootloader: config.ALL_BOOTLOADER_VENDORS.includes(vendorNum)
            });
          }
        } catch {}
      }
    } catch (err) {
      if (config.DEBUG) console.warn("Failed to read sysfs USB devices:", err);
    }
  }

  // Inspect /dev/hidraw nodes
  const devDir = "/dev";
  let hidrawTotal = 0;
  let hidrawAccessible = 0;

  if (fs.existsSync(devDir)) {
    try {
      const hidrawNodes = fs.readdirSync(devDir).filter((n) => n.startsWith("hidraw"));
      hidrawTotal = hidrawNodes.length;
      for (const node of hidrawNodes) {
        try {
          fs.accessSync(path.join(devDir, node), fs.constants.R_OK | fs.constants.W_OK);
          hidrawAccessible++;
        } catch {}
      }
    } catch {}
  }

  // Inspect udev rules installation
  const udevRulePaths = [
    "/lib/udev/rules.d/60-keychron.rules",
    "/usr/lib/udev/rules.d/60-keychron.rules",
    "/etc/udev/rules.d/60-keychron.rules"
  ];
  const activeRulePaths = udevRulePaths.filter((p) => fs.existsSync(p));

  return {
    devices,
    hidraw: { total: hidrawTotal, accessible: hidrawAccessible },
    udevRules: activeRulePaths
  };
}

function showDeviceInspectorDialog(parentWindow) {
  const { devices, hidraw, udevRules } = inspectHardware();

  let message = "";
  let detail = "";

  if (devices.length > 0) {
    message = `Detected ${devices.length} Keychron / Bootloader Device(s)`;
    const devLines = devices.map(
      (d) =>
        `• ${d.product} (${d.vendorId}:${d.productId})${d.isBootloader ? " [DFU Bootloader]" : ""}`
    );
    detail += devLines.join("\n") + "\n\n";
  } else {
    message = "No Keychron Hardware Detected";
    detail += "• No Keychron keyboards, mice, or bootloaders found on active USB ports.\n";
    detail += "• Check that your keyboard switch is set to 'Cable' mode and connected directly via USB.\n\n";
  }

  detail += `Linux HID Nodes: ${hidraw.accessible} of ${hidraw.total} accessible to current user\n`;

  if (udevRules.length > 0) {
    detail += `Active udev Rule: ${udevRules[0]}\n`;
  } else {
    detail += "Active udev Rule: None detected (run 'bash scripts/install-udev.sh')\n";
  }

  dialog.showMessageBox(parentWindow, {
    type: devices.length > 0 ? "info" : "warning",
    title: "Keychron Hardware Inspector",
    message,
    detail,
    buttons: ["OK"]
  });
}

module.exports = {
  inspectHardware,
  showDeviceInspectorDialog
};
