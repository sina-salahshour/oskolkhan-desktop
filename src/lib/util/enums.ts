/**
 * Enum helpers and badge derivation shared across screens.
 */
import type { GenericTitle, GroupInfoV2 } from '$lib/api';

export const CONTENT_TYPE_MOVIE = 1;
export const CONTENT_TYPE_SERIES = 2;

export function isSeries(t: Pick<GenericTitle, 'contenttype'>): boolean {
	return t.contenttype === CONTENT_TYPE_SERIES;
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

/** Rating chip meta, keyed by Rating.type from the backend. */
export interface RatingMeta {
	key: string;
	label: string;
	accent: string;
}

export const RATING_META: Record<number, RatingMeta> = {
	1: { key: 'imdb', label: 'IMDb', accent: '#f5c518' },
	2: { key: 'meta', label: 'Metacritic', accent: '#66cc33' },
	3: { key: 'rotten', label: 'Rotten', accent: '#fa320a' },
	4: { key: 'audience', label: 'Audience', accent: '#ff6b6b' }
};

export function ratingMeta(type: number): RatingMeta {
	return RATING_META[type] ?? { key: String(type), label: '', accent: 'var(--accent)' };
}

export type Badge = { label: string; tone: 'gold' | 'blue' | 'violet' | 'red' | 'neutral' };

/** Quality badges from a GroupInfoV2 node (4K/HDR/DV/DTS/x265 ...). */
export function groupBadges(g: GroupInfoV2): Badge[] {
	const badges: Badge[] = [];
	if (g.SceenSize >= 2160) badges.push({ label: '4K', tone: 'gold' });
	else if (g.SceenSize >= 1080) badges.push({ label: '1080p', tone: 'neutral' });
	else if (g.SceenSize >= 720) badges.push({ label: '720p', tone: 'neutral' });
	if (g.isHDR) badges.push({ label: 'HDR', tone: 'violet' });
	if (g.isDolbyVision) badges.push({ label: 'DV', tone: 'violet' });
	if (g.isDts) badges.push({ label: 'DTS', tone: 'blue' });
	if (g.x265) badges.push({ label: 'x265', tone: 'blue' });
	if (g.isDub) badges.push({ label: 'دوبله', tone: 'red' });
	if (g.SoftSub) badges.push({ label: 'زیرنویس', tone: 'neutral' });
	return badges;
}

/** Badges derived from a title's free-text quality string (Q). */
export function titleQualityBadges(t: Pick<GenericTitle, 'Q' | 'isDub'>): Badge[] {
	const badges: Badge[] = [];
	const q = (t.Q || '').toUpperCase();
	if (q.includes('4K') || q.includes('2160')) badges.push({ label: '4K', tone: 'gold' });
	if (q.includes('HDR')) badges.push({ label: 'HDR', tone: 'violet' });
	if (q.includes('DV') || q.includes('DOLBY')) badges.push({ label: 'DV', tone: 'violet' });
	if (q.includes('X265') || q.includes('HEVC')) badges.push({ label: 'x265', tone: 'blue' });
	if (t.isDub) badges.push({ label: 'دوبله', tone: 'red' });
	return badges;
}
