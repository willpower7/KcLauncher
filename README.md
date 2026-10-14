# KcLauncher

**KcLauncher** is a native Linux desktop application port of the **Keychron Launcher** (`launcher.keychron.com`) packaged into a standalone `.deb` package. It enables full customization of Keychron keyboards and mice—including key remapping, RGB backlighting, rotary encoders, macros, and firmware flashing—**without opening a web browser**.

---

## Why KcLauncher?

Keychron's official configurator is hosted as a web application that relies on Chromium's **WebHID** and **WebUSB** APIs. On Linux, this creates significant friction:

1. **Browser Incompatibility**: Firefox, WebKit, and non-Chromium browsers do not support WebHID.
2. **Permission Denied (`/dev/hidraw*`)**: By default, Linux restricts raw HID access to root, causing browser connections to hang on *"HID device connected"*.
3. **No Standalone Native App**: Users are forced to launch a full web browser just to remap keys or adjust lighting.
4. **Firmware / DFU Locking**: Flashing firmware or factory resetting requires DFU mode permissions which are often blocked in browsers.

**KcLauncher solves all of these issues** by embedding Chromium's WebHID engine into a lightweight Electron shell, bundling Linux hardware `udev` rules, and packaging directly into a `.deb` package with automatic permission configuration upon installation.

---

## Key Features

- **No Browser Required**: Runs as a first-class Linux desktop application with system tray, window state memory, and native menu shortcuts.
- **Automated WebHID Pairing**: Automatically identifies Keychron hardware (`Vendor ID 0x3434`), eliminating manual device picker popups.
- **Zero-Config Hardware Access**: The Debian package automatically installs `/lib/udev/rules.d/60-keychron.rules` and triggers `udevadm`, granting non-root user access instantly.
- **Firmware & DFU Support**: Fully permits WebUSB communication with STM32 (`0483:df11`) and RP2040 bootloaders for safe firmware updates.
- **Offline Fallback Screen**: Gracefully detects offline status and provides diagnostic instructions rather than a blank browser error page.
- **Secure Sandboxing**: Restricts WebHID access strictly to Keychron's official endpoints and intercepts unapproved external navigation.

---

## Project Structure

```
KcLauncher/
├── docs/                       # Detailed documentation & technical specs
│   ├── ARCHITECTURE.md         # Architecture, WebHID lifecycle & security model
│   ├── LINUX_UDEV_GUIDE.md     # udev hardware rules & device identifiers
│   ├── PACKAGING_DEB.md        # Debian packaging pipeline & electron-builder
│   └── ROADMAP.md              # Project roadmap & offline caching milestones
├── src/                        # Application source code
│   ├── main/                   # Electron main process
│   │   ├── index.js            # Main lifecycle & window management
│   │   ├── hid-handler.js      # WebHID / WebUSB auto-selection & permissions
│   │   ├── menu.js             # Linux native application menu & shortcuts
│   │   ├── config.js           # Configuration constants & host allowlists
│   │   └── preload.js          # Preload context bridge
│   ├── renderer/               # Renderer assets & offline UI
│   │   ├── offline.html        # Offline diagnostic screen
│   │   ├── offline.css         # Styling for offline screen
│   │   └── offline.js          # Diagnostics script
│   └── assets/                 # Icons, logos, and visual assets
│       ├── icon.svg            # Vector application icon
│       ├── icons/              # Multi-resolution icons (64x64 to 512x512)
│       └── keychron-logo.svg   # Official Keychron logo
├── build/                      # Build configurations & packaging scripts
│   ├── electron-builder.yml    # electron-builder Linux deb & AppImage spec
│   ├── debian/                 # Debian packaging hooks (postinst, postrm, .desktop)
│   └── udev/                   # 60-keychron.rules installed to /lib/udev/rules.d/
├── scripts/                    # Automation scripts
│   ├── setup-dev.sh            # Setup developer dependencies
│   ├── build-deb.sh            # One-step script to build .deb
│   └── install-udev.sh         # Standalone udev installer for local dev
├── package.json                # Project dependencies & npm scripts
└── .gitignore
```

---

## Getting Started (Development)

### Prerequisites

- Linux (Ubuntu, Pop!_OS, Debian, Mint, or Fedora)
- **Node.js 18+** and **npm**

To install Node.js on Ubuntu/Pop!_OS:
```bash
sudo apt update
sudo apt install -y nodejs npm
```

### Installation

```bash
# Clone the repository
git clone git@github.com:willpower7/KcLauncher.git
cd KcLauncher

# Install dependencies
npm install

# (Optional) Install udev rules for local development without .deb install
bash scripts/install-udev.sh
```

### Running Locally

```bash
# Launch the application
npm start

# Launch in debug mode with DevTools open
npm run dev
```

---

## Building the `.deb` Package

To compile and package KcLauncher into a Debian package (`.deb`):

```bash
npm run build:deb
```

The output package will be generated inside the `dist/` directory:
```
dist/Keychron Launcher_1.0.0_amd64.deb
```

### Installing the `.deb`

Install the package via `apt` or `dpkg`:
```bash
sudo apt install ./dist/Keychron\ Launcher_1.0.0_amd64.deb
# or
sudo dpkg -i ./dist/Keychron\ Launcher_1.0.0_amd64.deb
```

Once installed:
- KcLauncher is available in your desktop application launcher under **Keychron Launcher**.
- udev rules are loaded automatically.
- Plug your Keychron keyboard in via USB, ensure the toggle switch is in **Cable** mode, and launch!

---

## Important Device Note

> [!IMPORTANT]
> **WebHID requires a wired USB connection.**
> Keychron keyboards do **not** support WebHID configuration over standard Bluetooth or 2.4GHz wireless modes. Ensure your keyboard's physical switch (on the back or side) is set to **Cable**, and plug it directly into your PC using a USB cable.

---

## Documentation Links

- [System Architecture & WebHID Design](file:///home/willi/Projects/KcLauncher/docs/ARCHITECTURE.md)
- [Linux udev Rules Reference](file:///home/willi/Projects/KcLauncher/docs/LINUX_UDEV_GUIDE.md)
- [Debian Packaging Guide](file:///home/willi/Projects/KcLauncher/docs/PACKAGING_DEB.md)
- [Project Roadmap](file:///home/willi/Projects/KcLauncher/docs/ROADMAP.md)

---

## License

MIT License. See [LICENSE](file:///home/willi/Projects/KcLauncher/LICENSE) for details. Keychron Launcher web interface and trademarks are the property of Keychron.