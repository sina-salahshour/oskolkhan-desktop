/**
 * Formatting helpers. Persian digits + locale-aware numbers.
 */
import { i18n } from '$lib/i18n';

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toFaDigits(input: string | number): string {
	return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Localize digits in a string to the current language. */
export function digits(input: string | number): string {
	return i18n.lang === 'fa' ? toFaDigits(input) : String(input);
}

export function formatNumber(n: number): string {
	const s = new Intl.NumberFormat('en-US').format(n);
	return digits(s);
}

/** 742310 -> "742K" / "742هزار"-ish compact */
export function compact(n: number): string {
	if (n >= 1_000_000) return digits((n / 1_000_000).toFixed(1)) + 'M';
	if (n >= 1000) return digits(Math.round(n / 1000)) + 'K';
	return digits(n);
}

/** seconds -> H:MM:SS or M:SS */
export function timecode(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
	const ss = String(sec).padStart(2, '0');
	const core = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
	return digits(core);
}

/** runtime in minutes -> "2h 46m" / "۲ساعت ۴۶دقیقه" */
export function runtime(minutes: number): string {
	if (!minutes) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (i18n.lang === 'fa') {
		const parts = [];
		if (h) parts.push(`${toFaDigits(h)} ساعت`);
		if (m) parts.push(`${toFaDigits(m)} دقیقه`);
		return parts.join(' و ');
	}
	return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

export function fileSize(mb: number): string {
	if (mb >= 1024) return `${digits((mb / 1024).toFixed(1))} GB`;
	return `${digits(Math.round(mb))} MB`;
}

export function speed(kbps: number): string {
	if (kbps <= 0) return '—';
	if (kbps >= 1024) return `${digits((kbps / 1024).toFixed(1))} MB/s`;
	return `${digits(Math.round(kbps))} KB/s`;
}

export function year(y: number): string {
	return y ? digits(y) : '';
}

export function rankText(rank: number): string {
	return rank > 0 ? digits(rank.toFixed(1)) : '—';
}
