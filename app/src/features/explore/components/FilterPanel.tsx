/** Advanced filter panel (AdvanceFiler builder): content type, sort, genre/country
 * chips, publish-year + per-source rating ranges + content-warning ranges, and the
 * genre/rating "match" switches. Emits a debounced Partial<AdvanceFiler> on change
 * and immediately on Apply/Reset. Options come from usePreload() via usePreloadLookups. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Film, Clapperboard, LayoutGrid, Filter, X } from '@lucide/react';
import type { AdvanceFiler, PairData, RatingCluster } from '@/lib/api';
import {
	Button,
	Chip,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SegmentedControl,
	Slider,
	Switch,
	Skeleton
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { loc, usePreloadLookups, SORT_OPTIONS } from '../util';

export interface FilterPanelProps {
	onChange: (filter: Partial<AdvanceFiler>) => void;
}

const YEAR_MIN = 1900;
const YEAR_MAX = 2026;

interface RangeRowProps {
	label: string;
	min: number;
	max: number;
	step: number;
	from: number;
	to: number;
	onChange: (from: number, to: number) => void;
}

function RangeRow({ label, min, max, step, from, to, onChange }: RangeRowProps) {
	const { lang } = useI18n();
	const fmt = (n: number) => loc(lang, step < 1 ? n.toFixed(1) : String(Math.round(n)));
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between text-sm">
				<span className="text-fg">{label}</span>
				<span className="tabular-nums text-muted">
					{fmt(from)} – {fmt(to)}
				</span>
			</div>
			<Slider
				size="sm"
				min={min}
				max={max}
				step={step}
				value={[from, to]}
				minStepsBetweenThumbs={0}
				onValueChange={(v) => onChange(v[0] ?? min, v[1] ?? max)}
				aria-label={label}
			/>
		</div>
	);
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
	const { lang } = useI18n();
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<h3 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h3>
				{count ? (
					<span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-soft px-1.5 text-[11px] font-bold text-accent">
						{loc(lang, count)}
					</span>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function FilterPanel({ onChange }: FilterPanelProps) {
	const { t, lang } = useI18n();
	const lookups = usePreloadLookups();

	const [contentType, setContentType] = useState('0');
	const [sort, setSort] = useState(SORT_OPTIONS[0].value);
	const [genres, setGenres] = useState<number[]>([]);
	const [countries, setCountries] = useState<number[]>([]);

	const [year, setYear] = useState<[number, number]>([YEAR_MIN, YEAR_MAX]);
	const [imdb, setImdb] = useState<[number, number]>([0, 10]);
	const [meta, setMeta] = useState<[number, number]>([0, 100]);
	const [rotten, setRotten] = useState<[number, number]>([0, 100]);
	const [mdl, setMdl] = useState<[number, number]>([0, 10]);
	const [mal, setMal] = useState<[number, number]>([0, 10]);
	const [dizi, setDizi] = useState<[number, number]>([0, 10]);
	const [violence, setViolence] = useState<[number, number]>([0, 10]);
	const [profanity, setProfanity] = useState<[number, number]>([0, 10]);
	const [drugs, setDrugs] = useState<[number, number]>([0, 10]);
	const [frightening, setFrightening] = useState<[number, number]>([0, 10]);

	const [genreMatch, setGenreMatch] = useState(false);
	const [ratingMatch, setRatingMatch] = useState(false);

	const pair = (from: number, to: number, min: number, max: number): PairData | undefined =>
		from <= min && to >= max ? undefined : { From: from, To: to };
	const cluster = (from: number, to: number, min: number, max: number): RatingCluster | undefined => {
		const p = pair(from, to, min, max);
		return p ? { PartOn: p, PartTwo: null } : undefined;
	};

	const build = (): Partial<AdvanceFiler> => {
		const f: Partial<AdvanceFiler> = {
			Sort: sort,
			genreMatch: genreMatch ? 1 : 0,
			ratingMatch: ratingMatch ? 1 : 0
		};
		if (contentType !== '0') f.contentType = Number(contentType);
		if (genres.length) f.Genres = [...genres];
		if (countries.length) f.Countries = [...countries];
		const py = pair(year[0], year[1], YEAR_MIN, YEAR_MAX);
		if (py) f.PublishYear = py;
		const im = cluster(imdb[0], imdb[1], 0, 10);
		if (im) f.Imdb = im;
		const me = cluster(meta[0], meta[1], 0, 100);
		if (me) f.Meta = me;
		const ro = cluster(rotten[0], rotten[1], 0, 100);
		if (ro) f.Rotten = ro;
		const md = cluster(mdl[0], mdl[1], 0, 10);
		if (md) f.MDL = md;
		const ma = cluster(mal[0], mal[1], 0, 10);
		if (ma) f.Mal = ma;
		const di = cluster(dizi[0], dizi[1], 0, 10);
		if (di) f.Dizi = di;
		const vi = pair(violence[0], violence[1], 0, 10);
		if (vi) f.Violence = vi;
		const pr = pair(profanity[0], profanity[1], 0, 10);
		if (pr) f.Profanity = pr;
		const dr = pair(drugs[0], drugs[1], 0, 10);
		if (dr) f.Drugs = dr;
		const fr = pair(frightening[0], frightening[1], 0, 10);
		if (fr) f.Frightening = fr;
		return f;
	};

	// Debounced change plumbing. `build` reads the latest state via a ref-free
	// closure recreated each render; the timer fires the newest one.
	const timer = useRef<ReturnType<typeof setTimeout>>();
	const buildRef = useRef(build);
	buildRef.current = build;
	const schedule = () => {
		clearTimeout(timer.current);
		timer.current = setTimeout(() => onChange(buildRef.current()), 350);
	};
	const applyNow = () => {
		clearTimeout(timer.current);
		onChange(buildRef.current());
	};
	useEffect(() => () => clearTimeout(timer.current), []);

	const toggle = (list: number[], set: (v: number[]) => void, id: number) => {
		set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
		schedule();
	};

	const reset = () => {
		setContentType('0');
		setSort(SORT_OPTIONS[0].value);
		setGenres([]);
		setCountries([]);
		setYear([YEAR_MIN, YEAR_MAX]);
		setImdb([0, 10]);
		setMeta([0, 100]);
		setRotten([0, 100]);
		setMdl([0, 10]);
		setMal([0, 10]);
		setDizi([0, 10]);
		setViolence([0, 10]);
		setProfanity([0, 10]);
		setDrugs([0, 10]);
		setFrightening([0, 10]);
		setGenreMatch(false);
		setRatingMatch(false);
		clearTimeout(timer.current);
		onChange({ Sort: SORT_OPTIONS[0].value, genreMatch: 0, ratingMatch: 0 });
	};

	const selectedCount = genres.length + countries.length;

	return (
		<div className="flex max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface">
			<header className="flex items-center justify-between border-b border-line px-4 py-3">
				<h2 className="text-base font-semibold text-fg">{t('common.filter')}</h2>
				<Button variant="ghost" size="sm" leftIcon={X} onClick={reset}>
					{t('common.reset')}
				</Button>
			</header>

			<div className="flex flex-col gap-5 overflow-y-auto p-4">
				{/* Content type */}
				<Section title={t('common.filter')}>
					<SegmentedControl
						size="sm"
						value={contentType}
						onValueChange={(v) => {
							setContentType(v);
							schedule();
						}}
						options={[
							{ value: '0', label: t('common.all'), icon: LayoutGrid },
							{ value: '1', label: t('common.movie'), icon: Film },
							{ value: '2', label: t('common.series'), icon: Clapperboard }
						]}
						aria-label={t('common.filter')}
					/>
				</Section>

				{/* Sort */}
				<Section title={t('explore.sort')}>
					<Select
						value={String(sort)}
						onValueChange={(v) => {
							setSort(Number(v));
							schedule();
						}}
					>
						<SelectTrigger aria-label={t('explore.sort')}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORT_OPTIONS.map((o) => (
								<SelectItem key={o.value} value={String(o.value)}>
									{t(o.labelKey)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Section>

				{/* Genres */}
				<Section title={t('explore.genres')} count={genres.length}>
					{lookups.genreOptions.length ? (
						<div className="flex flex-wrap gap-2">
							{lookups.genreOptions.map((g) => (
								<Chip
									key={g.id}
									selected={genres.includes(g.id)}
									onClick={() => toggle(genres, setGenres, g.id)}
								>
									{g.name}
								</Chip>
							))}
						</div>
					) : (
						<div className="flex flex-wrap gap-2">
							{Array.from({ length: 6 }, (_, i) => (
								<Skeleton key={i} rounded="full" className="h-8 w-16" />
							))}
						</div>
					)}
				</Section>

				{/* Countries */}
				<Section title={t('explore.countries')} count={countries.length}>
					{lookups.countryOptions.length ? (
						<div className="flex flex-wrap gap-2">
							{lookups.countryOptions.map((c) => (
								<Chip
									key={c.id}
									selected={countries.includes(c.id)}
									onClick={() => toggle(countries, setCountries, c.id)}
								>
									{c.name}
								</Chip>
							))}
						</div>
					) : (
						<div className="flex flex-wrap gap-2">
							{Array.from({ length: 6 }, (_, i) => (
								<Skeleton key={i} rounded="full" className="h-8 w-16" />
							))}
						</div>
					)}
				</Section>

				{/* Year */}
				<Section title={t('explore.year')}>
					<RangeRow
						label={t('common.year')}
						min={YEAR_MIN}
						max={YEAR_MAX}
						step={1}
						from={year[0]}
						to={year[1]}
						onChange={(a, b) => {
							setYear([a, b]);
							schedule();
						}}
					/>
				</Section>

				{/* Ratings */}
				<Section title={t('explore.ratings')}>
					<div className="flex flex-col gap-4">
						<RangeRow label={t('explore.imdb')} min={0} max={10} step={0.1} from={imdb[0]} to={imdb[1]} onChange={(a, b) => { setImdb([a, b]); schedule(); }} />
						<RangeRow label={t('explore.meta')} min={0} max={100} step={1} from={meta[0]} to={meta[1]} onChange={(a, b) => { setMeta([a, b]); schedule(); }} />
						<RangeRow label={t('explore.rotten')} min={0} max={100} step={1} from={rotten[0]} to={rotten[1]} onChange={(a, b) => { setRotten([a, b]); schedule(); }} />
						<RangeRow label={t('explore.mdl')} min={0} max={10} step={0.1} from={mdl[0]} to={mdl[1]} onChange={(a, b) => { setMdl([a, b]); schedule(); }} />
						<RangeRow label={t('explore.mal')} min={0} max={10} step={0.1} from={mal[0]} to={mal[1]} onChange={(a, b) => { setMal([a, b]); schedule(); }} />
						<RangeRow label={t('explore.dizi')} min={0} max={10} step={0.1} from={dizi[0]} to={dizi[1]} onChange={(a, b) => { setDizi([a, b]); schedule(); }} />
					</div>
				</Section>

				{/* Content warnings */}
				<Section title={t('explore.contentWarnings')}>
					<div className="flex flex-col gap-4">
						<RangeRow label={t('explore.violence')} min={0} max={10} step={1} from={violence[0]} to={violence[1]} onChange={(a, b) => { setViolence([a, b]); schedule(); }} />
						<RangeRow label={t('explore.profanity')} min={0} max={10} step={1} from={profanity[0]} to={profanity[1]} onChange={(a, b) => { setProfanity([a, b]); schedule(); }} />
						<RangeRow label={t('explore.drugs')} min={0} max={10} step={1} from={drugs[0]} to={drugs[1]} onChange={(a, b) => { setDrugs([a, b]); schedule(); }} />
						<RangeRow label={t('explore.frightening')} min={0} max={10} step={1} from={frightening[0]} to={frightening[1]} onChange={(a, b) => { setFrightening([a, b]); schedule(); }} />
					</div>
				</Section>

				{/* Match toggles */}
				<Section title={t('common.filter')}>
					<div className="flex flex-col gap-3">
						<label className="flex items-center justify-between gap-3 text-sm text-fg">
							<span>{t('explore.genreMatch')}</span>
							<Switch
								checked={genreMatch}
								onCheckedChange={(v) => {
									setGenreMatch(v);
									schedule();
								}}
							/>
						</label>
						<label className="flex items-center justify-between gap-3 text-sm text-fg">
							<span>{t('explore.ratingMatch')}</span>
							<Switch
								checked={ratingMatch}
								onCheckedChange={(v) => {
									setRatingMatch(v);
									schedule();
								}}
							/>
						</label>
					</div>
				</Section>
			</div>

			<footer className="border-t border-line p-4">
				<Button fullWidth leftIcon={Filter} onClick={applyNow}>
					{t('common.apply')}
					{selectedCount ? ` · ${loc(lang, selectedCount)}` : ''}
				</Button>
			</footer>
		</div>
	);
}
