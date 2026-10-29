# OskolKhan desktop — Linux build/install (Electron + React + Rust core sidecar).
#
#   make appimage   build the release sidecar, stage it, build the AppImage
#   make install    appimage + copy it into the lib prefix + generate a .desktop
#   make uninstall   remove the installed AppImage, icon and .desktop entry
#   make clean       remove build/stage artifacts
#
# Prefix is configurable:  make install PREFIX=/opt   (default: ~/.local)

SHELL := /bin/bash

APP        := app
PNPM       ?= pnpm
CARGO      ?= cargo

PREFIX      ?= $(HOME)/.local
LIBDIR      ?= $(PREFIX)/lib/oskolkhan
DESKTOP_DIR ?= $(HOME)/.local/share/applications
# Network interface the core binds its upstream HTTP clients to (the OskolKhan
# backend is reachable on the physical uplink, even when a VPN owns the default
# route). Baked into the launcher's env; override with: make install BIND_IFACE=…
BIND_IFACE  ?= wlan0

CORE_BIN    := target/release/oskol-serve
STAGED_BIN  := $(APP)/resources/oskol-serve
# Resolved lazily (after `appimage` has produced it).
APPIMAGE     = $(firstword $(wildcard $(APP)/dist/*.AppImage))

INSTALLED_APPIMAGE := $(LIBDIR)/OskolKhan.AppImage
INSTALLED_ICON     := $(LIBDIR)/oskolkhan.png
DESKTOP_FILE       := $(DESKTOP_DIR)/oskolkhan.desktop

.PHONY: all help deps core stage build appimage install uninstall clean pkg

all: appimage

help:
	@echo "Targets: core stage build appimage install pkg uninstall clean"
	@echo "  make appimage   # release sidecar + staged + electron-builder AppImage"
	@echo "  make install    # + copy into $(LIBDIR) and write $(DESKTOP_FILE)"
	@echo "  make pkg        # build + install an Arch package (PKGBUILD, pacman-tracked)"
	@echo "Vars: PREFIX=$(PREFIX)  LIBDIR=$(LIBDIR)  DESKTOP_DIR=$(DESKTOP_DIR)  BIND_IFACE=$(BIND_IFACE)"

deps:
	$(PNPM) --dir $(APP) install

# Build the Rust core sidecar (release) and stage it where electron-builder
# picks it up as extraResources (-> resources/oskol-serve in the AppImage).
core:
	$(CARGO) build --release -p oskol-core --bin oskol-serve

stage: core
	@mkdir -p $(APP)/resources
	cp -f $(CORE_BIN) $(STAGED_BIN)
	chmod +x $(STAGED_BIN)

# Just the electron-vite bundle (main + preload + renderer), no packaging.
build: deps
	$(PNPM) --dir $(APP) run build

# Full AppImage: staged sidecar + deps + electron-builder.
appimage: stage deps
	$(PNPM) --dir $(APP) run appimage
	@echo "Built: $(APPIMAGE)"

install: appimage
	@test -n "$(APPIMAGE)" || { echo "ERROR: no AppImage found in $(APP)/dist"; exit 1; }
	@mkdir -p $(LIBDIR) $(DESKTOP_DIR)
	install -m 0755 "$(APPIMAGE)" "$(INSTALLED_APPIMAGE)"
	install -m 0644 $(APP)/resources/icon.png "$(INSTALLED_ICON)"
	@printf '%s\n' \
	  '[Desktop Entry]' \
	  'Type=Application' \
	  'Name=OskolKhan' \
	  'GenericName=Media Client' \
	  'Comment=OskolKhan desktop media client' \
	  'Exec=env OSKOL_BIND_INTERFACE=$(BIND_IFACE) $(INSTALLED_APPIMAGE) --ozone-platform-hint=auto %U' \
	  'Icon=$(INSTALLED_ICON)' \
	  'Terminal=false' \
	  'Categories=AudioVideo;Player;' \
	  'StartupWMClass=OskolKhan' \
	  > "$(DESKTOP_FILE)"
	-update-desktop-database "$(DESKTOP_DIR)" 2>/dev/null || true
	@echo "Installed: $(INSTALLED_APPIMAGE)"
	@echo "Desktop entry: $(DESKTOP_FILE)"

uninstall:
	rm -f "$(INSTALLED_APPIMAGE)" "$(INSTALLED_ICON)" "$(DESKTOP_FILE)"
	-rmdir "$(LIBDIR)" 2>/dev/null || true
	-update-desktop-database "$(DESKTOP_DIR)" 2>/dev/null || true
	@echo "Uninstalled."

# Build + install an Arch package via the repo PKGBUILD (pacman-tracked install,
# uninstall with `pacman -R oskolkhan`). Bind interface: make pkg BIND_IFACE=eth0
# `-d` skips makepkg's dependency check: the toolchain here is rustup (cargo/rustc)
# and corepack (pnpm), which aren't pacman packages, so the check would wrongly
# fail. The tools listed in PKGBUILD's makedepends must still be on PATH.
pkg:
	BIND_IFACE=$(BIND_IFACE) makepkg -d -i -f

clean:
	rm -rf $(APP)/out $(APP)/dist
	rm -f $(STAGED_BIN)
	rm -rf pkg src *.pkg.tar.*
