/**
 * Image URL builders. The core serves images through the local asset server at
 * `assetBase` (from CoreStatus). Patterns are from android-analysis §3:
 *   <assetBase>/Ca8dA/images300<img>.jpg
 *   <assetBase>/Ca8dA/images800<img>_bg.jpg
 *   <assetBase>/Ca8dA/images1500/<img>_bg.jpg
 *   <assetBase>/Ca8dA/images{100,300}/{names,titles}/<x>.jpg
 */
import { status } from '$lib/stores/status.svelte';

function base(): string {
	return status.assetBase;
}

/** Poster image. `img` is the GenericTitle.img token (already starts with "/"). */
export function poster(img: string, size: 300 | 800 = 300): string {
	if (!img) return '';
	const b = base();
	if (!b) return '';
	return size === 800 ? `${b}/Ca8dA/images800${img}_bg.jpg` : `${b}/Ca8dA/images300${img}.jpg`;
}

/** Large backdrop / hero image. */
export function backdrop(img: string): string {
	if (!img) return '';
	const b = base();
	if (!b) return '';
	return `${b}/Ca8dA/images1500/${img.replace(/^\//, '')}_bg.jpg`;
}

/** Person / cast thumbnail. `name` is the tti.img token. */
export function person(name: string): string {
	if (!name) return '';
	const b = base();
	if (!b) return '';
	return `${b}/Ca8dA/images300/names/${name.replace(/^\//, '')}.jpg`;
}

/**
 * Deterministic gradient placeholder from a seed (title id or name). Used while
 * images load or when they fail — keeps the cinematic look offline / in mock.
 */
export function placeholderGradient(seed: string | number): string {
	let h = 0;
	const s = String(seed);
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
	const h2 = (h + 40) % 360;
	return `linear-gradient(145deg, hsl(${h} 32% 22%), hsl(${h2} 38% 12%))`;
}
