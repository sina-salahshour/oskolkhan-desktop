/** Badge / rating / enum helpers for the title screen (ported from the old enums). */
import type { BadgeVariant } from '../../../components/ui';
import type { GenericTitle, GroupInfoV2 } from '../../../lib/api/types';

export const CONTENT_TYPE_MOVIE = 1;
export const CONTENT_TYPE_SERIES = 2;

export function isSeries(t: Pick<GenericTitle, 'contenttype'>): boolean {
	return t.contenttype === CONTENT_TYPE_SERIES;
}

export type BadgeTone = BadgeVariant;
export interface BadgeSpec {
	label: string;
	variant: BadgeTone;
}

export function groupBadges(g: GroupInfoV2): BadgeSpec[] {
	const out: BadgeSpec[] = [];
	if (g.SceenSize >= 2160) out.push({ label: '4K', variant: 'warning' });
	else if (g.SceenSize >= 1080) out.push({ label: '1080p', variant: 'neutral' });
	else if (g.SceenSize >= 720) out.push({ label: '720p', variant: 'neutral' });
	if (g.isHDR) out.push({ label: 'HDR', variant: 'accent' });
	if (g.isDolbyVision) out.push({ label: 'DV', variant: 'accent' });
	if (g.isDts) out.push({ label: 'DTS', variant: 'outline' });
	if (g.x265) out.push({ label: 'x265', variant: 'outline' });
	if (g.isDub) out.push({ label: 'دوبله', variant: 'danger' });
	if (g.SoftSub) out.push({ label: 'زیرنویس', variant: 'neutral' });
	return out;
}

export function titleQualityBadges(t: Pick<GenericTitle, 'Q' | 'isDub'>): BadgeSpec[] {
	const out: BadgeSpec[] = [];
	const q = (t.Q || '').toUpperCase();
	if (q.includes('4K') || q.includes('2160')) out.push({ label: '4K', variant: 'warning' });
	if (q.includes('HDR')) out.push({ label: 'HDR', variant: 'accent' });
	if (q.includes('DV') || q.includes('DOLBY')) out.push({ label: 'DV', variant: 'accent' });
	if (q.includes('X265') || q.includes('HEVC')) out.push({ label: 'x265', variant: 'outline' });
	if (t.isDub) out.push({ label: 'دوبله', variant: 'danger' });
	return out;
}

const RATING_META: Record<number, { label: string; accent: string }> = {
	1: { label: 'IMDb', accent: '#f5c518' },
	2: { label: 'Metacritic', accent: '#66cc33' },
	3: { label: 'Rotten Tomatoes', accent: '#fa320a' },
	4: { label: 'Audience', accent: '#ff6b6b' },
	5: { label: 'MyDramaList', accent: '#2e51a2' },
	6: { label: 'MyAnimeList', accent: '#2e51a2' },
	7: { label: 'Dizi', accent: '#e50914' }
};

export function ratingMeta(type: number): { label: string; accent: string } {
	return RATING_META[type] ?? { label: '', accent: 'var(--accent)' };
}
