/**
 * Formatting helpers (locale-aware). Persian uses Eastern-Arabic digits; English
 * uses Latin. Keep these pure so they work in any component.
 */
import type { Lang } from '../../i18n/strings';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Convert Latin digits in a string to Persian digits (for lang === 'fa'). */
export function toFaDigits(input: string | number): string {
	return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** Localize a number: thousands grouping + Persian digits when fa. */
export function formatNumber(n: number, lang: Lang): string {
	const s = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(n);
	return s;
}

/** Compact counts like 12.3K / 1.2M (used for votes). */
export function formatCompact(n: number, lang: Lang): string {
	return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
		notation: 'compact',
		maximumFractionDigits: 1
	}).format(n);
}

/** Bytes → human size. */
export function formatBytes(bytes: number, lang: Lang = 'en'): string {
	if (!bytes || bytes < 0) return lang === 'fa' ? toFaDigits('0 B') : '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	const val = bytes / Math.pow(1024, i);
	const str = `${val.toFixed(val >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
	return lang === 'fa' ? toFaDigits(str) : str;
}

/** Seconds → mm:ss / h:mm:ss (for the player seekbar). */
export function formatDuration(totalSeconds: number, lang: Lang = 'en'): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const pad = (x: number) => String(x).padStart(2, '0');
	const str = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
	return lang === 'fa' ? toFaDigits(str) : str;
}

/** Runtime minutes → localized "1h 42m" / "۱ ساعت ۴۲ دقیقه"-ish compact form. */
export function formatRuntime(minutes: number, lang: Lang = 'en'): string {
	if (!minutes) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	const parts: string[] = [];
	if (h > 0) parts.push(`${h}h`);
	if (m > 0) parts.push(`${m}m`);
	const str = parts.join(' ');
	return lang === 'fa' ? toFaDigits(str.replace('h', 'س').replace('m', 'د')) : str;
}

/** Download speed bytes/s → "1.2 MB/s". */
export function formatSpeed(bps: number, lang: Lang = 'en'): string {
	return `${formatBytes(bps, lang)}/s`;
}

/** Clamp + round a 0..1 progress to a percentage int. */
export function toPercent(received: number, total: number): number {
	if (!total) return 0;
	return Math.max(0, Math.min(100, Math.round((received / total) * 100)));
}
