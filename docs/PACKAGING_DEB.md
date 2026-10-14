# Debian Packaging Guide (.deb)

This guide documents the packaging pipeline for building and distributing **KcLauncher** as a native Debian package (`.deb`).

---

## 1. Packaging Architecture

KcLauncher uses **`electron-builder`** with Debian-specific metadata and scripts to produce an installable `.deb` package.

### Target Filesystem Layout:

When the generated `.deb` is installed on a user's machine, it populates:

| Installed Path | Purpose |
| :--- | :--- |
| `/opt/Keychron Launcher/` | Application bundle (Electron binary, ASAR package, resources) |
| `/usr/bin/kclauncher` | Symlink to `/opt/Keychron Launcher/kclauncher` |
| `/usr/share/applications/kclauncher.desktop` | System desktop entry for GNOME / Pop!_OS / KDE |
| `/usr/share/icons/hicolor/*/apps/kclauncher.png` | Desktop icons across standard resolutions |
| `/lib/udev/rules.d/60-keychron.rules` | Hardware permissions for Keychron USB / WebHID |

---

## 2. Package Configuration

Packaging is configured in [build/electron-builder.yml](file:///home/willi/Projects/KcLauncher/build/electron-builder.yml):

```yaml
appId: com.willpower7.kclauncher
productName: Keychron Launcher
executableName: kclauncher

linux:
  target:
    - target: deb
      arch:
        - x64
    - target: AppImage
      arch:
        - x64
  category: Utility
  icon: src/assets/icons
  extraFiles:
    - from: build/udev/60-keychron.rules
      to: lib/udev/rules.d/60-keychron.rules

deb:
  packageCategory: utils
  priority: optional
  afterInstall: build/debian/postinst
  afterRemove: build/debian/postrm
  fpm:
    - --deb-compression
    - xz
  depends:
    - libnotify4
    - libsecret-1-0
    - libnss3
    - libasound2
    - udev
```

---

## 3. How to Build the `.deb`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run the Packaging Script
```bash
npm run build:deb
```
Or use the automated script:
```bash
bash scripts/build-deb.sh
```

### Step 3: Inspect the Generated Package
Once completed, the package is in `dist/`:
```bash
ls -lh dist/*.deb
```

Inspect the files contained in the package:
```bash
dpkg-deb -c dist/Keychron\ Launcher_1.0.0_amd64.deb
```

Inspect package metadata:
```bash
dpkg-deb -I dist/Keychron\ Launcher_1.0.0_amd64.deb
```

---

## 4. Testing Installation

Install the generated `.deb` on your system:
```bash
sudo apt install ./dist/Keychron\ Launcher_1.0.0_amd64.deb
```

Verify that udev rules were installed and reloaded:
```bash
cat /lib/udev/rules.d/60-keychron.rules
```

Launch the installed app from your terminal or desktop menu:
```bash
kclauncher
```

To remove the package cleanly:
```bash
sudo apt remove kclauncher
```
