#!/usr/bin/env bash
#
# release.sh — bump the version everywhere, build the Arch package, then push the
# commit + tag to GitHub and cut a release (with the .pkg.tar.zst attached).
#
# Usage:
#   scripts/release.sh <major|minor|patch|X.Y.Z> [options]
#
# Options:
#   --no-build     skip the makepkg build; release the source tag with no asset
#   --draft        create the GitHub release as a draft
#   --prerelease   mark the GitHub release as a pre-release
#   --notes <txt>  use <txt> as the release notes instead of auto-generated ones
#   -y, --yes      don't prompt for confirmation
#   -h, --help     show this help
#
# Version lives in four files, all kept in lockstep:
#   Cargo.toml ([workspace.package] version)   root package.json
#   app/package.json                           PKGBUILD (pkgver; pkgrel reset to 1)
#
# Requirements: git, gh (authenticated), cargo, pnpm, node, makepkg (for the build).
set -euo pipefail

# --- locate repo root ------------------------------------------------------
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
	echo "error: not inside a git repository" >&2
	exit 1
}
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }
info() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

# --- parse args ------------------------------------------------------------
BUMP=""
DO_BUILD=1
DRAFT=""
PRERELEASE=""
NOTES=""
ASSUME_YES=0
while [ $# -gt 0 ]; do
	case "$1" in
		major|minor|patch) BUMP="$1" ;;
		[0-9]*.[0-9]*.[0-9]*) BUMP="$1" ;;
		--no-build) DO_BUILD=0 ;;
		--draft) DRAFT="--draft" ;;
		--prerelease) PRERELEASE="--prerelease" ;;
		--notes) shift; NOTES="${1:-}" ;;
		-y|--yes) ASSUME_YES=1 ;;
		-h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
		*) die "unknown argument: $1 (want major|minor|patch|X.Y.Z)" ;;
	esac
	shift
done
[ -n "$BUMP" ] || die "missing bump: major|minor|patch|X.Y.Z"

# --- preflight -------------------------------------------------------------
command -v gh    >/dev/null || die "gh not found"
command -v cargo >/dev/null || die "cargo not found"
command -v pnpm  >/dev/null || die "pnpm not found"
command -v node  >/dev/null || die "node not found"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated (run: gh auth login)"
git remote get-url origin >/dev/null 2>&1 || die "no 'origin' remote"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ -z "$(git status --porcelain)" ] || die "working tree is dirty — commit or stash first"

# --- compute the new version ----------------------------------------------
CUR=$(node -p "require('./package.json').version")
semver_bump() {
	local cur="${1%%-*}" kind="$2" MA MI PA
	IFS=. read -r MA MI PA <<<"$cur"
	case "$kind" in
		major) echo "$((MA + 1)).0.0" ;;
		minor) echo "$MA.$((MI + 1)).0" ;;
		patch) echo "$MA.$MI.$((PA + 1))" ;;
		*)     echo "$kind" ;; # explicit X.Y.Z
	esac
}
NEWV=$(semver_bump "$CUR" "$BUMP")
echo "$NEWV" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || die "computed version '$NEWV' is not X.Y.Z"
TAG="v$NEWV"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists"

# --- confirm ---------------------------------------------------------------
info "Release plan"
echo "    version : $CUR  ->  $NEWV"
echo "    branch  : $BRANCH"
echo "    tag     : $TAG"
echo "    build   : $([ $DO_BUILD -eq 1 ] && echo 'yes (makepkg, asset attached)' || echo 'no')"
echo "    remote  : $(git remote get-url origin)"
if [ "$ASSUME_YES" -ne 1 ]; then
	printf 'Proceed? [y/N] '
	read -r reply
	case "$reply" in y|Y|yes|YES) ;; *) die "aborted" ;; esac
fi

# --- bump version in all four files (revert the lot on any later failure) --
set_json_version() { # $1=file ; reads target version from $V
	# Replace only the FIRST "version": "..." (the package's own; dependency specs
	# are "name": "range", never a "version" key), preserving all other formatting.
	perl -0777 -i -pe 'BEGIN{$v=$ENV{V}} s/("version"\s*:\s*")[^"]*(")/$1$v$2/' "$1"
}
info "Bumping version to $NEWV"
V="$NEWV" set_json_version package.json
V="$NEWV" set_json_version app/package.json
sed -i -E "s/^version = \"[^\"]*\"/version = \"$NEWV\"/" Cargo.toml
sed -i -E "s/^pkgver=.*/pkgver=$NEWV/; s/^pkgrel=.*/pkgrel=1/" PKGBUILD
# keep Cargo.lock's workspace-member entry in sync (no dependency bumps)
cargo update --workspace --offline >/dev/null 2>&1 || cargo update --workspace >/dev/null

# verify the four files agree
check=$(printf '%s\n' \
	"$(node -p "require('./package.json').version")" \
	"$(node -p "require('./app/package.json').version")" \
	"$(sed -nE 's/^version = "([^"]+)"/\1/p' Cargo.toml | head -1)" \
	"$(sed -nE 's/^pkgver=(.*)/\1/p' PKGBUILD)" | sort -u)
[ "$check" = "$NEWV" ] || { git checkout -- . ; die "version files disagree after bump: [$check]"; }

# --- build the package (optional) ------------------------------------------
ASSET=""
if [ "$DO_BUILD" -eq 1 ]; then
	info "Building package (makepkg)…"
	# Clean stale build dirs first: a leftover pkg/ (from an interrupted or
	# concurrent run) makes makepkg abort with "Dotfile found in package root"
	# because its own .BUILDINFO/.MTREE/.PKGINFO are already there.
	rm -rf pkg src 2>/dev/null || true
	rm -f oskolkhan-*.pkg.tar.* 2>/dev/null || true
	if ! BIND_IFACE="${BIND_IFACE:-wlan0}" makepkg -d -f; then
		git checkout -- .
		die "makepkg failed — version bump reverted"
	fi
	ASSET=$(ls -1t oskolkhan-"$NEWV"-*.pkg.tar.zst 2>/dev/null | head -1 || true)
	[ -n "$ASSET" ] || { git checkout -- . ; die "package built but artifact not found"; }
	info "Built $ASSET"
fi

# --- commit, tag, push -----------------------------------------------------
info "Committing + tagging $TAG"
git commit -aqm "release: $TAG"
git tag -a "$TAG" -m "$TAG"
info "Pushing $BRANCH + $TAG"
git push origin "$BRANCH"
git push origin "$TAG"

# --- GitHub release --------------------------------------------------------
info "Creating GitHub release $TAG"
notes_arg=(--generate-notes)
[ -n "$NOTES" ] && notes_arg=(--notes "$NOTES")
gh release create "$TAG" \
	--title "$TAG" \
	$DRAFT $PRERELEASE \
	"${notes_arg[@]}" \
	${ASSET:+"$ASSET"}

info "Done: $(gh release view "$TAG" --json url -q .url 2>/dev/null || echo "$TAG")"
