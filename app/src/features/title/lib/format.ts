/** Feature-local, language-aware formatting helpers for the title screen. */
import type { Lang } from '../../../i18n/strings';
import { toFaDigits } from '../../../lib/util/format';

export function digits(input: string | number, lang: Lang): string {
	return lang === 'fa' ? toFaDigits(input) : String(input);
}

export function year(y: number, lang: Lang): string {
	return y ? digits(y, lang) : '';
}

export function rankText(rank: number, lang: Lang): string {
	return rank > 0 ? digits(rank.toFixed(1), lang) : '—';
}

export function compact(n: number, lang: Lang): string {
	if (n >= 1e6) return `${digits((n / 1e6).toFixed(1), lang)}M`;
	if (n >= 1000) return `${digits(Math.round(n / 1000), lang)}K`;
	return digits(n, lang);
}

export function runtime(minutes: number, lang: Lang): string {
	if (!minutes) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (lang === 'fa') {
		const parts: string[] = [];
		if (h) parts.push(`${toFaDigits(h)} ساعت`);
		if (m) parts.push(`${toFaDigits(m)} دقیقه`);
		return parts.join(' و ');
	}
	return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

/** FileV2.Size is expressed in MB. */
export function fileSizeMb(mb: number, lang: Lang): string {
	if (mb >= 1024) return `${digits((mb / 1024).toFixed(1), lang)} GB`;
	return `${digits(Math.round(mb), lang)} MB`;
}

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|webm|m4v|ts|flv|wmv|3gp|ogv|mpg|mpeg|m2ts)(?=$|[?#])/gi;

/**
 * Derives the container/format label (MP4, MKV, …) from a file urn. External
 * links (YouTube/Aparat trailers, urn starting with http) have no container and
 * return null. Otherwise the last recognized extension in the urn wins.
 */
export function videoFormat(urn: string): string | null {
	if (!urn || /^https?:\/\//i.test(urn)) return null;
	const matches = urn.match(VIDEO_EXT);
	if (!matches || matches.length === 0) return null;
	return matches[matches.length - 1].slice(1).toUpperCase();
}
