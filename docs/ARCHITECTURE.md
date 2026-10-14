# Architecture Specification: KcLauncher

## 1. Overview & System Rationale

**KcLauncher** ports the web-based **Keychron Launcher** to a native Linux desktop application packaged as a Debian `.deb`.

The application utilizes **Electron** (Chromium + Node.js) as its host engine.

```mermaid
flowchart TD
    subgraph Linux OS
        USB[USB Subsystem]
        UDEV[udev Rules: /lib/udev/rules.d/60-keychron.rules]
        HIDRAW[/dev/hidraw*]
        USB --> UDEV --> HIDRAW
    end

    subgraph KcLauncher Architecture
        MAIN[Electron Main Process\nsrc/main/index.js]
        HID[WebHID / WebUSB Manager\nsrc/main/hid-handler.js]
        MENU[Native Application Menu\nsrc/main/menu.js]
        
        MAIN --> HID
        MAIN --> MENU

        subgraph Chromium Window
            WEB[Keychron Launcher Web App\nlauncher.keychron.com]
            OFFLINE[Local Offline Fallback\nsrc/renderer/offline.html]
            PRELOAD[Preload Script\nsrc/main/preload.js]
        end

        MAIN -->|Embeds & Manages| WEB
        MAIN -->|Fallback on failure| OFFLINE
        PRELOAD -->|Sandboxed Bridge| WEB
    end

    HIDRAW -->|Granted Access| HID
    HID -->|Auto-Pairs Vendor 0x3434| WEB
```

---

## 2. Why Electron over Tauri / WebKitGTK?

A common question when building Linux desktop wrappers is whether to use **Tauri** or **Electron**:

| Criteria | Electron | Tauri (WebKitGTK on Linux) |
| :--- | :--- | :--- |
| **Blink / Chromium Engine** | **Yes** (Embedded) | **No** (Uses system WebKitGTK) |
| **WebHID API (`navigator.hid`)** | **Full Support** | **Not Supported** (WebKitGTK lacks WebHID) |
| **WebUSB API (`navigator.usb`)** | **Full Support** | **Not Supported** |
| **Device Selection Hooks** | `session.on('select-hid-device')` | None |
| **Binary Size** | ~80 MB | ~15 MB |

> [!IMPORTANT]
> **WebHID is currently only supported in Chromium/Blink engines.** WebKitGTK (used by Tauri on Linux) does **not** implement WebHID or WebUSB APIs. Without WebHID, communication with Keychron keyboards over raw USB reports is impossible in a web view. Electron is therefore the technically correct, fully compatible choice.

---

## 3. WebHID & WebUSB Device Lifecycle

In a standard web browser, when Keychron Launcher requests a device (`navigator.hid.requestDevice({ filters })`), the browser opens an interactive popup dialog asking the user to choose their keyboard.

In KcLauncher:
1. **Permission Check**: `appSession.setPermissionCheckHandler` intercepts requests for `'hid'` and `'usb'`. It validates that the requesting domain is in the `ALLOWED_HOST_PATTERNS` allowlist.
2. **Device Discovery**: Electron triggers `select-hid-device` with candidate HID devices enumerated by the OS.
3. **Auto-Selection**:
   - KcLauncher inspects all devices for `vendorId === 0x3434` (Keychron).
   - If a Keychron device is found, it is automatically passed back to the callback (`callback(keychronDevice.deviceId)`).
   - The user experiences a frictionless connection without manual popups.
4. **DFU Flashing**: For firmware flashing or bootloader recovery, `select-usb-device` similarly handles STM32 (`0x0483:0xdf11`) and RP2040 (`0x2e8a:0x0003`) bootloader devices.

---

## 4. Security & Sandboxing Model

To maintain system security:
- **`contextIsolation: true`**: The renderer code cannot tamper with the main process.
- **`nodeIntegration: false`**: Remote web content cannot execute Node.js commands.
- **Navigation Guard**: The application intercepts `will-navigate` and `setWindowOpenHandler`. Any link attempting to navigate away from Keychron domains is prevented from loading inside the app and is routed to the user's default web browser via `shell.openExternal`.
- **Allowed Origins**:
  - `https://launcher.keychron.com`
  - `https://keychron.com`
  - `https://launcher.keychron.cn`
  - `file://` (Internal offline assets)

---

## 5. Offline Resilience

When starting without network connectivity:
- The `did-fail-load` event catches connection errors to `launcher.keychron.com`.
- Rather than rendering a standard Chromium connection error page, it redirects to the bundled [offline.html](../src/renderer/offline.html).
- The user is presented with a retry button and diagnostic information regarding physical cable connection and Linux `udev` permissions.
