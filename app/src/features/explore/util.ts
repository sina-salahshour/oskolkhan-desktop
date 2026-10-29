/**
 * Feature-local helpers for Explore (title naming, localized digits, quality
 * badges, preload-backed genre/country lookups, sort options). Self-contained so
 * the feature stays decoupled from the others.
 */
import type { GenericTitle } from '@/lib/api';
import type { Lang } from '@/i18n';
import type { BadgeVariant } from '@/components/ui';
import { toFaDigits } from '@/lib/util/format';
import { useSessionStore } from '@/lib/stores/session';
import { usePreload } from '@/lib/query';

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

export interface Option {
	id: number;
	name: string;
}

/** Genre/country option lists + id->name lookups from the PreLoad config. */
export function usePreloadLookups() {
	const { data } = usePreload();
	const genre = data?.genre ?? [];
	const countries = data?.countries ?? [];
	return {
		genreOptions: genre.map((name, id) => ({ id, name })).filter((o) => o.name),
		countryOptions: countries.map((name, id) => ({ id, name })).filter((o) => o.name),
		genres: (ids: number[]) => ids.map((id) => genre[id]).filter(Boolean),
		countries: (ids: number[]) => ids.map((id) => countries[id]).filter(Boolean)
	};
}

export interface SortOption {
	value: number;
	labelKey: string;
}

export const SORT_OPTIONS: SortOption[] = [
	{ value: 0, labelKey: 'sort.popular' },
	{ value: 1, labelKey: 'sort.newest' },
	{ value: 2, labelKey: 'sort.topRated' },
	{ value: 3, labelKey: 'sort.mostVoted' },
	{ value: 4, labelKey: 'sort.alphabetical' }
];
