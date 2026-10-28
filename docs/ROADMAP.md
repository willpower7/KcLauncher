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

- [x] **Asset Mirroring Pipeline**: Automated script (`scripts/mirror-offline-assets.js` / `npm run mirror:assets`) to mirror Keychron Launcher's Angular bundle and run offline with `--local-mirror`.
- [ ] **Custom Scheme / Local File Protocol**: Serve mirrored web assets via a secure `kclauncher://` protocol or internal localhost loopback server.
- [ ] **Firmware Cache**: Local repository of common Keychron QMK firmware binaries and factory reset images for offline flashing.

---

## Phase 3: Local Profiles & Keymap Backups

- [x] **Local Layout Storage**: Save and load custom VIA / Keychron keymap JSON files directly to `~/.config/kclauncher/profiles/`.
- [x] **One-Click Profile Switching**: Fast switching and inspection of key layout profiles from the system tray and application menu.
- [x] **Device Diagnostics & Inspector**: Real-time display of connected Keychron models, Linux hidraw node permissions, and udev rules status.

---

## Phase 4: CI/CD & Automated GitHub Releases

- [x] **GitHub Actions Workflow**: Automatically build `.deb` and `.AppImage` binaries on tag pushes (`v1.0.0`, etc.).
- [x] **APT Repository Hosting Tooling**: Automated generator (`scripts/generate-apt-repo.sh` / `npm run generate:apt`) to produce Debian pool, Packages.gz, and Release metadata.
