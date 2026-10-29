/**
 * Settings screen. Theme + interface language come from the foundation `ui`
 * store; title language, view modes, buffer profile and subtitle defaults from
 * the feature-local settings store (persisted). Default export = SettingsScreen
 * (router wires it to /settings).
 */
import { useState, type ReactNode } from 'react';
import {
	MoonStar,
	SunMedium,
	Monitor,
	Languages,
	LayoutGrid,
	List as ListIcon,
	Clapperboard,
	Check,
	Trash2
} from '@lucide/react';
import { Button, SegmentedControl, Slider, Label, Icon } from '@/components/ui';
import { useUiStore } from '@/lib/stores/ui';
import { useI18n } from '@/i18n';
import { usePreload } from '@/lib/query';
import { toFaDigits } from '@/lib/util/format';
import { toast } from '@/lib/stores/toast';
import { useSettingsStore, type ViewMode, type SubtitleEdge } from './store';

const CACHE_KEY = 'oskol:cache';
const DEVICE_ID = 'a1b2c3d4e5f6';
const FALLBACK_UA =
	'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

const EDGE_SHADOW: Record<SubtitleEdge, string> = {
	none: 'none',
	outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
	drop: '2px 2px 4px rgba(0,0,0,.9)',
	raised: '0 -1px 0 rgba(255,255,255,.55), 0 2px 2px rgba(0,0,0,.8)'
};

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
			<h2 className="text-lg font-bold text-fg">{title}</h2>
			{children}
		</section>
	);
}

function Row({ label, children, stack = false }: { label: string; children: ReactNode; stack?: boolean }) {
	return (
		<div
			className={
				stack
					? 'flex flex-col gap-3 border-t border-line pt-4'
					: 'flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4'
			}
		>
			<Label className="text-muted">{label}</Label>
			{children}
		</div>
	);
}

export default function SettingsScreen() {
	const { t, lang } = useI18n();
	const theme = useUiStore((s) => s.theme);
	const setTheme = useUiStore((s) => s.setTheme);
	const setLang = useUiStore((s) => s.setLang);

	const settings = useSettingsStore();
	const preload = usePreload();
	const userAgent = preload.data?.Envs || FALLBACK_UA;

	const [cleared, setCleared] = useState(false);

	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	const viewOptions = [
		{ value: 'grid' as ViewMode, label: t('explore.gridView'), icon: LayoutGrid },
		{ value: 'list' as ViewMode, label: t('explore.listView'), icon: ListIcon },
		{ value: 'poster' as ViewMode, label: t('common.movie'), icon: Clapperboard }
	];

	function clearCache() {
		try {
			localStorage.removeItem(CACHE_KEY);
		} catch {
			/* ignore */
		}
		setCleared(true);
		toast({ tone: 'success', title: t('settings.cacheCleared') });
		setTimeout(() => setCleared(false), 2600);
	}

	const sub = settings.subtitle;

	return (
		<div className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-4 py-6">
			<h1 className="text-2xl font-extrabold text-fg">{t('settings.title')}</h1>

			<Section title={t('settings.appearance')}>
				<Row label={t('settings.theme')}>
					<SegmentedControl
						value={theme}
						onValueChange={(v) => setTheme(v as 'dark' | 'light' | 'system')}
						aria-label={t('settings.theme')}
						options={[
							{ value: 'dark', label: t('settings.themeDark'), icon: MoonStar },
							{ value: 'light', label: t('settings.themeLight'), icon: SunMedium },
							{ value: 'system', label: t('common.all'), icon: Monitor }
						]}
					/>
				</Row>
				<Row label={t('settings.language')}>
					<SegmentedControl
						value={lang}
						onValueChange={(v) => setLang(v as 'fa' | 'en')}
						aria-label={t('settings.language')}
						options={[
							{ value: 'fa', label: 'فارسی', icon: Languages },
							{ value: 'en', label: 'English', icon: Languages }
						]}
					/>
				</Row>
				<Row label={t('settings.titleLanguage')}>
					<SegmentedControl
						value={settings.titleLang}
						onValueChange={(v) => settings.setTitleLang(v as 'persian' | 'original')}
						aria-label={t('settings.titleLanguage')}
						options={[
							{ value: 'persian', label: t('settings.titlePersian') },
							{ value: 'original', label: t('settings.titleOriginal') }
						]}
					/>
				</Row>
			</Section>

			<Section title={t('settings.playback')}>
				<Row label={t('settings.movieView')}>
					<SegmentedControl
						size="sm"
						value={settings.movieView}
						onValueChange={(v) => settings.setMovieView(v as ViewMode)}
						aria-label={t('settings.movieView')}
						options={viewOptions}
					/>
				</Row>
				<Row label={t('settings.seriesView')}>
					<SegmentedControl
						size="sm"
						value={settings.seriesView}
						onValueChange={(v) => settings.setSeriesView(v as ViewMode)}
						aria-label={t('settings.seriesView')}
						options={viewOptions}
					/>
				</Row>
				<Row label={t('settings.bufferProfile')}>
					<SegmentedControl
						value={settings.buffer}
						onValueChange={(v) => settings.setBuffer(v as 'low' | 'balanced' | 'high')}
						aria-label={t('settings.bufferProfile')}
						options={[
							{ value: 'low', label: t('settings.bufferLow') },
							{ value: 'balanced', label: t('settings.bufferBalanced') },
							{ value: 'high', label: t('settings.bufferHigh') }
						]}
					/>
				</Row>
			</Section>

			<Section title={t('settings.subtitleDefaults')}>
				<div
					aria-hidden="true"
					className="relative h-[150px] overflow-hidden rounded-lg border border-line bg-bg"
				>
					<span
						className="absolute inset-x-0 mx-auto w-fit max-w-[92%] truncate rounded px-2.5 py-0.5"
						style={{
							fontFamily: `${sub.font}, sans-serif`,
							fontSize: `${(sub.size / 100) * 1.25}rem`,
							color: sub.color,
							textShadow: EDGE_SHADOW[sub.edge],
							background: `rgba(0,0,0,${sub.background / 100})`,
							bottom: `${sub.position * 0.7 + 6}%`
						}}
					>
						این یک زیرنویس نمونه است · Sample subtitle
					</span>
				</div>
				<Row label={t('player.font')}>
					<SegmentedControl
						size="sm"
						value={sub.font}
						onValueChange={(v) => settings.setSubtitle({ font: v })}
						aria-label={t('player.font')}
						options={['Vazirmatn', 'Estedad', 'Inter'].map((f) => ({ value: f, label: f }))}
					/>
				</Row>
				<Row label={`${t('player.fontSize')} · ${digit(sub.size)}%`} stack>
					<Slider
						min={50}
						max={200}
						step={5}
						value={[sub.size]}
						onValueChange={([v]) => settings.setSubtitle({ size: v })}
						aria-label={t('player.fontSize')}
					/>
				</Row>
				<Row label={`${t('player.position')} · ${digit(sub.position)}`} stack>
					<Slider
						min={0}
						max={100}
						value={[sub.position]}
						onValueChange={([v]) => settings.setSubtitle({ position: v })}
						aria-label={t('player.position')}
					/>
				</Row>
				<Row label={t('player.edge')}>
					<SegmentedControl
						size="sm"
						value={sub.edge}
						onValueChange={(v) => settings.setSubtitle({ edge: v as SubtitleEdge })}
						aria-label={t('player.edge')}
						options={[
							{ value: 'none', label: t('common.none') },
							{ value: 'outline', label: 'Outline' },
							{ value: 'drop', label: 'Drop' },
							{ value: 'raised', label: 'Raised' }
						]}
					/>
				</Row>
				<Row label={`${t('player.background')} · ${digit(sub.background)}%`} stack>
					<Slider
						min={0}
						max={100}
						value={[sub.background]}
						onValueChange={([v]) => settings.setSubtitle({ background: v })}
						aria-label={t('player.background')}
					/>
				</Row>
			</Section>

			<Section title={t('settings.storage')}>
				<Row label={t('settings.clearCache')}>
					<div className="flex items-center gap-3">
						{cleared ? (
							<span
								role="status"
								className="inline-flex items-center gap-2 rounded-md bg-success-soft px-3 py-1.5 text-sm text-success"
							>
								<Icon icon={Check} size={16} />
								{t('settings.cacheCleared')}
							</span>
						) : null}
						<Button variant="outline" leftIcon={Trash2} onClick={clearCache}>
							{t('settings.clearCache')}
						</Button>
					</div>
				</Row>
			</Section>

			<Section title={t('settings.device')}>
				<Row label={t('settings.deviceId')}>
					<code
						dir="ltr"
						className="select-all rounded-md border border-line bg-surface-2 px-3 py-1.5 font-latin text-sm text-fg"
					>
						{DEVICE_ID}
					</code>
				</Row>
				<Row label={t('settings.userAgent')} stack>
					<code
						dir="ltr"
						className="select-all break-all rounded-md border border-line bg-surface-2 px-3 py-2 font-latin text-xs leading-relaxed text-muted"
					>
						{userAgent}
					</code>
				</Row>
			</Section>
		</div>
	);
}
