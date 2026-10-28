# KcLauncher Project Roadmap

This roadmap tracks the development milestones for **KcLauncher** from the initial Linux desktop port to an offline-first Keychron suite.

---

## Phase 1: Native Linux Core & Automated Packaging (Current)

- [x] **Project Repository Foundation**: Standardized Linux application layout with `src/`, `docs/`, `build/`, and `scripts/`.
- [x] **Electron WebHID Engine**: Sandboxed Chromium runtime enabling full WebHID (`0x3434`) and WebUSB (`0x0483` / `0x2e8a`) hardware access.
- [x] **Hardware Auto-Selection**: Automatic handshake and pairing with connected Keychron devices without manual device pickers.
- [x] **Linux udev Packaging**: Integrated `60-keychron.rules` and `postinst`/`postrm` hooks within the `.deb` package for zero-config USB access.
- [x] **Desktop Integration**: Application menu, keyboard shortcuts, window state persistence, and XDG desktop entry.
- [x] **Offline Diagnostics**: Custom fallback screen when disconnected from the network.

---

## Phase 2: Full Offline Assets Mirroring & Local Serving

- [ ] **Asset Mirroring Pipeline**: Script to bundle and package Keychron Launcher's Angular frontend (`runtime`, `polyfills`, `main`, `styles`, and keyboard profile JSONs) directly into the app bundle.
- [ ] **Custom Scheme / Local File Protocol**: Serve mirrored web assets via a secure `kclauncher://` protocol or internal localhost loopback server.
- [ ] **Firmware Cache**: Local repository of common Keychron QMK firmware binaries and factory reset images for offline flashing.

---

## Phase 3: Local Profiles & Keymap Backups

- [ ] **Local Layout Storage**: Save and load custom VIA / Keychron keymap JSON files directly to `~/.config/kclauncher/profiles/`.
- [ ] **One-Click Profile Switching**: Allow fast switching between gaming, coding, and macOS/Windows key layouts from the system tray.
- [ ] **Device Diagnostics Tab**: Real-time display of USB report descriptors, firmware version, and battery percentage (for supported models).

---

## Phase 4: CI/CD & Automated GitHub Releases

- [x] **GitHub Actions Workflow**: Automatically build `.deb` and `.AppImage` binaries on tag pushes (`v1.0.0`, etc.).
- [ ] **APT Repository Hosting**: Host a GitHub Pages APT repository allowing users to install and update via `apt update && apt install kclauncher`.
