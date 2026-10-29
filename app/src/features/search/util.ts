/** Feature-local helpers for Search (title naming, localized digits, badges). */
import type { GenericTitle } from '@/lib/api';
import type { Lang } from '@/i18n';
import type { BadgeVariant } from '@/components/ui';
import { toFaDigits } from '@/lib/util/format';
import { useSessionStore } from '@/lib/stores/session';

export const useAssetBase = () => useSessionStore((s) => s.status?.assetBase ?? '');

export const loc = (lang: Lang, x: string | number) => (lang === 'fa' ? toFaDigits(x) : String(x));

export const titleName = (t: GenericTitle) => t.persian || t.titles[0] || '';
export const titleSub = (t: GenericTitle) => (t.persian ? t.titles[0] || '' : '');

export const isSeries = (t: GenericTitle) => t.contenttype === 2;

export function epLabel(lang: Lang, t: GenericTitle): string {
	if (!isSeries(t) || !t.S) return '';
	return `S${loc(lang, t.S)}·E${loc(lang, t.E || '1')}`;
}

export const rankText = (lang: Lang, rank: number) => (rank > 0 ? loc(lang, rank.toFixed(1)) : '');

export interface QBadge {
	label: string;
	variant: BadgeVariant;
}

export function qualityBadges(t: GenericTitle): QBadge[] {
	const out: QBadge[] = [];
	const q = (t.Q || '').toUpperCase();
	if (q.includes('4K') || q.includes('2160')) out.push({ label: '4K', variant: 'accent' });
	if (q.includes('HDR')) out.push({ label: 'HDR', variant: 'outline' });
	if (q.includes('DV') || q.includes('DOLBY')) out.push({ label: 'DV', variant: 'outline' });
	if (q.includes('X265') || q.includes('HEVC')) out.push({ label: 'x265', variant: 'neutral' });
	if (t.isDub) out.push({ label: 'دوبله', variant: 'warning' });
	return out;
}
