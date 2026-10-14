# Linux udev Hardware Configuration Guide

This document explains how Linux device permissions interact with Keychron keyboards, mice, and WebHID, and how **KcLauncher** automates hardware access.

---

## 1. The Linux HID Problem

On Linux, raw USB Human Interface Devices are exposed by the kernel under `/dev/hidraw0`, `/dev/hidraw1`, etc.

By default on Debian, Ubuntu, and Pop!_OS:
```bash
ls -l /dev/hidraw*
# crw------- 1 root root 241, 0 Oct 13 19:00 /dev/hidraw0
```

Notice the permissions: `0600` owned by `root:root`. Standard non-root users (and regular desktop applications) cannot read or write to `/dev/hidraw*`.

When a web browser or application attempts to connect via WebHID, the kernel denies permission. In Keychron Launcher, this manifests as:
- Connection button hanging indefinitely
- "HID device connected" without any response
- Key remapping failing to commit

---

## 2. The Solution: `udev` Rules

Linux uses `udev` to dynamically set device node permissions when hardware is plugged into a USB port.

KcLauncher includes [build/udev/60-keychron.rules](file:///home/willi/Projects/KcLauncher/build/udev/60-keychron.rules):

```udev
# Vendor ID 0x3434 (Keychron / Lemokey keyboards and mice)
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="3434", MODE="0660", TAG+="uaccess", TAG+="udev-acl"
SUBSYSTEM=="usb", ATTRS{idVendor}=="3434", MODE="0660", TAG+="uaccess", TAG+="udev-acl"

# Vendor ID 0x34b7 (XinJi / Keychron wireless mice & 4K/8K receivers)
KERNEL=="hidraw*", SUBSYSTEM=="hidraw", ATTRS{idVendor}=="34b7", MODE="0660", TAG+="uaccess", TAG+="udev-acl"
SUBSYSTEM=="usb", ATTRS{idVendor}=="34b7", MODE="0660", TAG+="uaccess", TAG+="udev-acl"

# STM32 DFU Bootloader (Keychron firmware flashing / factory resets)
SUBSYSTEM=="usb", ATTRS{idVendor}=="0483", ATTRS{idProduct}=="df11", MODE="0660", TAG+="uaccess", TAG+="udev-acl"

# Raspberry Pi RP2040 Bootloader (QMK Keychron boards)
SUBSYSTEM=="usb", ATTRS{idVendor}=="2e8a", ATTRS{idProduct}=="0003", MODE="0660", TAG+="uaccess", TAG+="udev-acl"
```

### Rule Breakdown:

* **`ATTRS{idVendor}=="3434"`**: Matches any hardware device manufactured by Keychron (or Lemokey).
* **`TAG+="uaccess"`**: In modern systemd-based Linux systems (Ubuntu, Pop!_OS, Debian, Fedora), `uaccess` tells `systemd-logind` to dynamically grant POSIX ACL read/write permissions to the currently active seat/user at the desktop session.
* **`MODE="0660"`**: Fallback permissions allowing read/write for root and group.

---

## 3. Automated Packaging Integration

When you install KcLauncher from the `.deb` package:

1. `dpkg` places `60-keychron.rules` into `/lib/udev/rules.d/60-keychron.rules`.
2. The package [postinst](file:///home/willi/Projects/KcLauncher/build/debian/postinst) script runs:
   ```bash
   udevadm control --reload-rules
   udevadm trigger --subsystem-match=hidraw
   udevadm trigger --subsystem-match=usb
   ```
3. Existing and newly plugged Keychron devices are instantly accessible to your user without requiring a reboot or manual command line intervention.

---

## 4. Manual Installation for Developers

If you are developing locally without installing the `.deb`:

```bash
bash scripts/install-udev.sh
```

Or manually:
```bash
sudo cp build/udev/60-keychron.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules
sudo udevadm trigger
```

---

## 5. Troubleshooting & Verification

### Step 1: Verify Hardware Detection
Ensure your keyboard is set to **Cable mode** and connected via USB:
```bash
lsusb | grep -i 3434
```
*Expected output:*
> `Bus 001 Device 005: ID 3434:0240 Keychron Keychron Q1`

### Step 2: Verify ACL Permissions
Check that your user has ACL read/write permissions on the hidraw device:
```bash
getfacl /dev/hidraw* | grep -E "file|user::"
```
*Expected output:*
> `user:<your-username>:rw-`
