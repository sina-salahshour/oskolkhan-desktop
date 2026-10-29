import type { Lang } from '../../../i18n/strings';
import { toFaDigits } from '../../../lib/util/format';

/** Localize digits in a string/number (Persian digits when lang === 'fa'). */
export function digits(x: string | number, lang: Lang): string {
	return lang === 'fa' ? toFaDigits(x) : String(x);
}

/** Seconds -> H:MM:SS or M:SS with localized digits. */
export function timecode(totalSeconds: number, lang: Lang = 'en'): string {
	const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	const str = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
	return digits(str, lang);
}
