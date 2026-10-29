# Maintainer: OskolKhan
# Personal/in-tree PKGBUILD: run `make pkg` from the repo root (which calls
# `makepkg -d -i -f`). The `-d` skips makepkg's dependency check because the
# toolchain here is rustup + corepack (not pacman packages); the tools below must
# still be on PATH.
# Builds the Rust core sidecar (release) + the Electron app (electron-builder
# unpacked), and installs them under /opt with a /usr/bin launcher that binds the
# core to the physical uplink (the backend is reachable there even behind a VPN).

pkgname=oskolkhan
pkgver=0.1.3
pkgrel=1
pkgdesc="OskolKhan desktop media client (Electron + React + Rust core)"
arch=('x86_64')
url="https://oskolkhan.app"
license=('custom')
# ffmpeg is used at runtime for in-app HLS playback; the rest are the system
# libraries the bundled Electron runtime links against.
depends=('ffmpeg' 'gtk3' 'nss' 'alsa-lib' 'libxss' 'at-spi2-core' 'libnotify')
makedepends=('pnpm' 'nodejs' 'rust' 'cargo')
# !lto is required: makepkg's global `lto` option compiles ring's C/asm with
# -flto=auto, producing bitcode objects that rust-lld can't resolve at the final
# link ("undefined symbol: ring_core_*"). The Rust release profile sets its own
# (disabled) LTO anyway.
options=('!strip' '!debug' '!lto')
# Interface the core binds its upstream clients to (override: BIND_IFACE=… makepkg).
_bind_iface="${BIND_IFACE:-wlan0}"

build() {
  cd "$startdir"
  # 1) release sidecar, staged where electron-builder bundles it as a resource.
  make stage
  # 2) renderer/main/preload bundle.
  pnpm --dir app install --prefer-offline
  pnpm --dir app run build
  # 3) unpacked Electron app (no AppImage — we install the dir straight to /opt).
  pnpm --dir app exec electron-builder --linux dir
}

package() {
  cd "$startdir"

  # The whole Electron app (its runtime + our out/ bundle + resources/oskol-serve).
  install -d "$pkgdir/opt/$pkgname"
  cp -a app/dist/linux-unpacked/. "$pkgdir/opt/$pkgname/"

  # Launcher: Wayland hint + bind the core to the physical uplink.
  install -d "$pkgdir/usr/bin"
  cat > "$pkgdir/usr/bin/$pkgname" <<EOF
#!/bin/sh
exec env OSKOL_BIND_INTERFACE="\${OSKOL_BIND_INTERFACE:-$_bind_iface}" \\
  "/opt/$pkgname/$pkgname" --ozone-platform-hint=auto "\$@"
EOF
  chmod 755 "$pkgdir/usr/bin/$pkgname"

  # Icon + desktop entry.
  install -Dm644 app/resources/icon.png \
    "$pkgdir/usr/share/icons/hicolor/512x512/apps/$pkgname.png"
  install -Dm644 /dev/stdin "$pkgdir/usr/share/applications/$pkgname.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=OskolKhan
GenericName=Media Client
Comment=OskolKhan desktop media client
Exec=$pkgname %U
Icon=$pkgname
Terminal=false
Categories=AudioVideo;Player;
StartupWMClass=OskolKhan
EOF

  # The chrome-sandbox helper must be setuid root for Electron's sandbox.
  if [ -f "$pkgdir/opt/$pkgname/chrome-sandbox" ]; then
    chmod 4755 "$pkgdir/opt/$pkgname/chrome-sandbox"
  fi
}
