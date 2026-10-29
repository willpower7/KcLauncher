#!/bin/bash
set -e

# ==============================================================================
# KcLauncher APT Repository Generator (for GitHub Pages hosting)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
REPO_DIR="${PROJECT_ROOT}/apt-repo"
DISTS_DIR="${REPO_DIR}/dists/stable/main/binary-amd64"
POOL_DIR="${REPO_DIR}/pool/main"

echo "=== Generating KcLauncher APT Repository ==="

if ! ls "${PROJECT_ROOT}/dist/"*.deb >/dev/null 2>&1; then
    echo "No .deb packages found in dist/. Please run 'npm run build:deb' first."
    exit 1
fi

mkdir -p "$DISTS_DIR"
mkdir -p "$POOL_DIR"

echo "Copying packages to pool..."
cp "${PROJECT_ROOT}/dist/"*.deb "$POOL_DIR/"

echo "Generating Packages index..."
cd "$REPO_DIR"

if command -v dpkg-scanpackages >/dev/null 2>&1; then
    dpkg-scanpackages --multiversion pool/ > "$DISTS_DIR/Packages"
else
    # Fallback generator if dpkg-dev is not installed
    echo "Notice: dpkg-scanpackages not found, generating metadata using dpkg-deb..."
    > "$DISTS_DIR/Packages"
    for deb in pool/main/*.deb; do
        [ -f "$deb" ] || continue
        dpkg-deb -I "$deb" | awk '
            BEGIN { FS=": " }
            /Package:/ { print "Package: " $2 }
            /Version:/ { print "Version: " $2 }
            /Architecture:/ { print "Architecture: " $2 }
            /Maintainer:/ { print "Maintainer: " $2 }
            /Installed-Size:/ { print "Installed-Size: " $2 }
            /Depends:/ { print "Depends: " $2 }
            /Section:/ { print "Section: " $2 }
            /Priority:/ { print "Priority: " $2 }
            /Description:/ { print "Description: " $2 }
        ' >> "$DISTS_DIR/Packages"
        FILESIZE=$(stat -c%s "$deb")
        SHA256=$(sha256sum "$deb" | awk '{print $1}')
        SHA512=$(sha512sum "$deb" | awk '{print $1}')
        echo "Filename: $deb" >> "$DISTS_DIR/Packages"
        echo "Size: $FILESIZE" >> "$DISTS_DIR/Packages"
        echo "SHA256: $SHA256" >> "$DISTS_DIR/Packages"
        echo "SHA512: $SHA512" >> "$DISTS_DIR/Packages"
        echo "" >> "$DISTS_DIR/Packages"
    done
fi

gzip -9c "$DISTS_DIR/Packages" > "$DISTS_DIR/Packages.gz"

echo "Generating Release file with cryptographic verification digests..."
cat <<EOF > "${REPO_DIR}/dists/stable/Release"
Origin: KcLauncher APT Repository
Label: KcLauncher
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Description: Native Linux desktop application for Keychron Launcher
Date: $(date -Ru)
EOF

# Calculate checksums for Packages and Packages.gz relative to dists/stable
cd "${REPO_DIR}/dists/stable"
PKG_FILE="main/binary-amd64/Packages"
PKG_GZ_FILE="main/binary-amd64/Packages.gz"

PKG_SIZE=$(stat -c%s "$PKG_FILE")
PKG_SHA256=$(sha256sum "$PKG_FILE" | awk '{print $1}')
PKG_SHA512=$(sha512sum "$PKG_FILE" | awk '{print $1}')

PKG_GZ_SIZE=$(stat -c%s "$PKG_GZ_FILE")
PKG_GZ_SHA256=$(sha256sum "$PKG_GZ_FILE" | awk '{print $1}')
PKG_GZ_SHA512=$(sha512sum "$PKG_GZ_FILE" | awk '{print $1}')

cat <<EOF >> "${REPO_DIR}/dists/stable/Release"
SHA256:
 $PKG_SHA256 $PKG_SIZE $PKG_FILE
 $PKG_GZ_SHA256 $PKG_GZ_SIZE $PKG_GZ_FILE
SHA512:
 $PKG_SHA512 $PKG_SIZE $PKG_FILE
 $PKG_GZ_SHA512 $PKG_GZ_SIZE $PKG_GZ_FILE
EOF

echo ""
echo "✓ APT repository generated successfully in: ${REPO_DIR}/"
echo "To host on GitHub Pages: commit and push the apt-repo directory to gh-pages."
