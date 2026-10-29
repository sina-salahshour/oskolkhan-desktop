/**
 * Image URL builders. The core serves images through its local asset server at
 * `assetBase` (from CoreStatus). Ported from the SvelteKit `src/lib/util/images.ts`;
 * the only change is that `assetBase` is passed in (from `useCoreStatus()` /
 * the session store) instead of read from a Svelte store.
 *
 * Patterns (android-analysis §3):
 *   <assetBase>/Ca8dA/images300<img>.jpg
 *   <assetBase>/Ca8dA/images800<img>_bg.jpg
 *   <assetBase>/Ca8dA/images1500/<img>_bg.jpg
 *   <assetBase>/Ca8dA/images{100,300}/{names,titles}/<x>.jpg
 */

/** Poster image. `img` is the GenericTitle.img token (already starts with "/"). */
export function poster(assetBase: string, img: string, size: 300 | 800 = 300): string {
	if (!img || !assetBase) return '';
	return size === 800
		? `${assetBase}/Ca8dA/images800${img}_bg.jpg`
		: `${assetBase}/Ca8dA/images300${img}.jpg`;
}

/** Large backdrop / hero image. */
export function backdrop(assetBase: string, img: string): string {
	if (!img || !assetBase) return '';
	return `${assetBase}/Ca8dA/images1500/${img.replace(/^\//, '')}_bg.jpg`;
}

/** Person / cast thumbnail. `name` is the tti.img token. */
export function person(assetBase: string, name: string): string {
	if (!name || !assetBase) return '';
	return `${assetBase}/Ca8dA/images300/names/${name.replace(/^\//, '')}.jpg`;
}

/** Title logo / name image (100/300 titles bucket). */
export function titleImage(assetBase: string, x: string, size: 100 | 300 = 300): string {
	if (!x || !assetBase) return '';
	return `${assetBase}/Ca8dA/images${size}/titles/${x.replace(/^\//, '')}.jpg`;
}

/**
 * Deterministic placeholder background from a seed (title id or name). Used while
 * images load or when they fail. Kept flat (not gradient-heavy per design): a
 * single muted surface tint derived from the seed.
 */
export function placeholderColor(seed: string | number): string {
	let h = 0;
	const s = String(seed);
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
	return `hsl(${h} 14% 16%)`;
}
