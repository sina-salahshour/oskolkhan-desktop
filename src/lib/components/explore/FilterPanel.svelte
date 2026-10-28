<script lang="ts">
	import type { AdvanceFiler, PairData, RatingCluster } from '$lib/api';
	import { preload } from '$lib/stores/preload.svelte';
	import { t } from '$lib/i18n';
	import { SORT_OPTIONS } from '$lib/util/enums';
	import { digits } from '$lib/util/format';
	import Chip from '$lib/components/Chip.svelte';
	import RangeSlider from '$lib/components/RangeSlider.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import Button from '$lib/components/Button.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';

	interface Props {
		/** Debounced on any change, and immediate on apply / reset. */
		onchange?: (filter: Partial<AdvanceFiler>) => void;
	}
	let { onchange }: Props = $props();

	// ---- range bounds -----------------------------------------------------
	const YEAR_MIN = 1900;
	const YEAR_MAX = 2026;

	// ---- control state ----------------------------------------------------
	let genres = $state<number[]>([]);
	let countries = $state<number[]>([]);
	let sort = $state<number>(SORT_OPTIONS[0].value);

	let yearFrom = $state(YEAR_MIN);
	let yearTo = $state(YEAR_MAX);

	let imdbFrom = $state(0);
	let imdbTo = $state(10);
	let metaFrom = $state(0);
	let metaTo = $state(100);
	let rottenFrom = $state(0);
	let rottenTo = $state(100);
	let mdlFrom = $state(0);
	let mdlTo = $state(10);
	let malFrom = $state(0);
	let malTo = $state(10);
	let diziFrom = $state(0);
	let diziTo = $state(10);

	let violenceFrom = $state(0);
	let violenceTo = $state(10);
	let profanityFrom = $state(0);
	let profanityTo = $state(10);
	let drugsFrom = $state(0);
	let drugsTo = $state(10);
	let frighteningFrom = $state(0);
	let frighteningTo = $state(10);

	let genreMatch = $state(false);
	let ratingMatch = $state(false);

	// ---- option lists (skip empty lookup slots) ---------------------------
	let genreOptions = $derived(preload.genreOptions.filter((o) => o.name));
	let countryOptions = $derived(preload.countryOptions.filter((o) => o.name));

	let sortOptions = $derived(SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })));

	let selectedCount = $derived(genres.length + countries.length);

	// ---- helpers ----------------------------------------------------------
	function pair(from: number, to: number, min: number, max: number): PairData | undefined {
		if (from <= min && to >= max) return undefined;
		return { From: from, To: to };
	}
	function cluster(from: number, to: number, min: number, max: number): RatingCluster | undefined {
		const p = pair(from, to, min, max);
		return p ? { PartOn: p, PartTwo: null } : undefined;
	}

	function buildFilter(): Partial<AdvanceFiler> {
		const f: Partial<AdvanceFiler> = {
			Sort: sort,
			genreMatch: genreMatch ? 1 : 0,
			ratingMatch: ratingMatch ? 1 : 0
		};
		if (genres.length) f.Genres = [...genres];
		if (countries.length) f.Countries = [...countries];

		const py = pair(yearFrom, yearTo, YEAR_MIN, YEAR_MAX);
		if (py) f.PublishYear = py;

		const imdb = cluster(imdbFrom, imdbTo, 0, 10);
		if (imdb) f.Imdb = imdb;
		const meta = cluster(metaFrom, metaTo, 0, 100);
		if (meta) f.Meta = meta;
		const rotten = cluster(rottenFrom, rottenTo, 0, 100);
		if (rotten) f.Rotten = rotten;
		const mdl = cluster(mdlFrom, mdlTo, 0, 10);
		if (mdl) f.MDL = mdl;
		const mal = cluster(malFrom, malTo, 0, 10);
		if (mal) f.Mal = mal;
		const dizi = cluster(diziFrom, diziTo, 0, 10);
		if (dizi) f.Dizi = dizi;

		const vio = pair(violenceFrom, violenceTo, 0, 10);
		if (vio) f.Violence = vio;
		const prof = pair(profanityFrom, profanityTo, 0, 10);
		if (prof) f.Profanity = prof;
		const drug = pair(drugsFrom, drugsTo, 0, 10);
		if (drug) f.Drugs = drug;
		const fright = pair(frighteningFrom, frighteningTo, 0, 10);
		if (fright) f.Frightening = fright;

		return f;
	}

	// ---- change plumbing --------------------------------------------------
	let timer: ReturnType<typeof setTimeout> | undefined;
	function scheduleApply() {
		clearTimeout(timer);
		timer = setTimeout(() => onchange?.(buildFilter()), 350);
	}
	function applyNow() {
		clearTimeout(timer);
		onchange?.(buildFilter());
	}
	$effect(() => () => clearTimeout(timer));

	function toggleGenre(id: number) {
		genres = genres.includes(id) ? genres.filter((g) => g !== id) : [...genres, id];
		scheduleApply();
	}
	function toggleCountry(id: number) {
		countries = countries.includes(id) ? countries.filter((c) => c !== id) : [...countries, id];
		scheduleApply();
	}

	function reset() {
		genres = [];
		countries = [];
		sort = SORT_OPTIONS[0].value;
		yearFrom = YEAR_MIN;
		yearTo = YEAR_MAX;
		imdbFrom = 0;
		imdbTo = 10;
		metaFrom = 0;
		metaTo = 100;
		rottenFrom = 0;
		rottenTo = 100;
		mdlFrom = 0;
		mdlTo = 10;
		malFrom = 0;
		malTo = 10;
		diziFrom = 0;
		diziTo = 10;
		violenceFrom = 0;
		violenceTo = 10;
		profanityFrom = 0;
		profanityTo = 10;
		drugsFrom = 0;
		drugsTo = 10;
		frighteningFrom = 0;
		frighteningTo = 10;
		genreMatch = false;
		ratingMatch = false;
		applyNow();
	}
</script>

<div class="panel">
	<header class="panel-head">
		<h2 class="section-title"><span>{t('common.filter')}</span></h2>
		<Button variant="ghost" size="sm" icon="x" onclick={reset}>{t('common.reset')}</Button>
	</header>

	<div class="groups">
		<!-- Sort -->
		<section class="group">
			<h3 class="group-title">{t('explore.sort')}</h3>
			<div class="sort">
				<SegmentedControl
					options={sortOptions}
					bind:value={sort}
					size="sm"
					onchange={scheduleApply}
				/>
			</div>
		</section>

		<!-- Genres -->
		<section class="group">
			<div class="group-head">
				<h3 class="group-title">{t('explore.genres')}</h3>
				{#if genres.length}<span class="count">{digits(genres.length)}</span>{/if}
			</div>
			{#if genreOptions.length}
				<div class="chips">
					{#each genreOptions as g (g.id)}
						<Chip
							selected={genres.includes(g.id)}
							removable
							onclick={() => toggleGenre(g.id)}
							onremove={() => toggleGenre(g.id)}>{g.name}</Chip
						>
					{/each}
				</div>
			{:else}
				<div class="chips">
					{#each Array(6) as _, i (i)}
						<Skeleton width="72px" height="30px" radius="var(--r-full)" />
					{/each}
				</div>
			{/if}
		</section>

		<!-- Countries -->
		<section class="group">
			<div class="group-head">
				<h3 class="group-title">{t('explore.countries')}</h3>
				{#if countries.length}<span class="count">{digits(countries.length)}</span>{/if}
			</div>
			{#if countryOptions.length}
				<div class="chips">
					{#each countryOptions as c (c.id)}
						<Chip
							selected={countries.includes(c.id)}
							removable
							onclick={() => toggleCountry(c.id)}
							onremove={() => toggleCountry(c.id)}>{c.name}</Chip
						>
					{/each}
				</div>
			{:else}
				<div class="chips">
					{#each Array(6) as _, i (i)}
						<Skeleton width="72px" height="30px" radius="var(--r-full)" />
					{/each}
				</div>
			{/if}
		</section>

		<!-- Year -->
		<section class="group">
			<h3 class="group-title">{t('explore.year')}</h3>
			<RangeSlider
				min={YEAR_MIN}
				max={YEAR_MAX}
				step={1}
				bind:from={yearFrom}
				bind:to={yearTo}
				label={t('explore.year')}
				onchange={scheduleApply}
			/>
		</section>

		<!-- Ratings -->
		<section class="group">
			<h3 class="group-title">{t('explore.ratings')}</h3>
			<div class="ranges">
				<RangeSlider
					min={0}
					max={10}
					step={0.1}
					bind:from={imdbFrom}
					bind:to={imdbTo}
					label={t('explore.imdb')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={100}
					step={1}
					bind:from={metaFrom}
					bind:to={metaTo}
					label={t('explore.meta')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={100}
					step={1}
					bind:from={rottenFrom}
					bind:to={rottenTo}
					label={t('explore.rotten')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={10}
					step={0.1}
					bind:from={mdlFrom}
					bind:to={mdlTo}
					label={t('explore.mdl')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={10}
					step={0.1}
					bind:from={malFrom}
					bind:to={malTo}
					label={t('explore.mal')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={10}
					step={0.1}
					bind:from={diziFrom}
					bind:to={diziTo}
					label={t('explore.dizi')}
					onchange={scheduleApply}
				/>
			</div>
		</section>

		<!-- Content warnings -->
		<section class="group">
			<h3 class="group-title">{t('explore.contentWarnings')}</h3>
			<div class="ranges">
				<RangeSlider
					min={0}
					max={10}
					step={1}
					bind:from={violenceFrom}
					bind:to={violenceTo}
					label={t('explore.violence')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={10}
					step={1}
					bind:from={profanityFrom}
					bind:to={profanityTo}
					label={t('explore.profanity')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={10}
					step={1}
					bind:from={drugsFrom}
					bind:to={drugsTo}
					label={t('explore.drugs')}
					onchange={scheduleApply}
				/>
				<RangeSlider
					min={0}
					max={10}
					step={1}
					bind:from={frighteningFrom}
					bind:to={frighteningTo}
					label={t('explore.frightening')}
					onchange={scheduleApply}
				/>
			</div>
		</section>

		<!-- Match toggles -->
		<section class="group">
			<div class="toggles">
				<Toggle
					bind:checked={genreMatch}
					label={t('explore.genreMatch')}
					onchange={scheduleApply}
				/>
				<Toggle
					bind:checked={ratingMatch}
					label={t('explore.ratingMatch')}
					onchange={scheduleApply}
				/>
			</div>
		</section>
	</div>

	<footer class="panel-foot">
		<Button variant="primary" icon="filter" block onclick={applyNow}>
			{t('common.apply')}{#if selectedCount}&nbsp;·&nbsp;{digits(selectedCount)}{/if}
		</Button>
	</footer>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		overflow: hidden;
	}
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: var(--sp-4);
		padding-block: var(--sp-3);
		border-block-end: 1px solid var(--border);
	}
	.panel-head .section-title {
		font-size: 1rem;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		padding: var(--sp-4);
		overflow-y: auto;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.group-head {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.group-title {
		font-size: 0.82rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.count {
		display: inline-grid;
		place-items: center;
		min-inline-size: 18px;
		block-size: 18px;
		padding-inline: 5px;
		border-radius: var(--r-full);
		background: var(--accent-soft);
		color: var(--accent-strong);
		font-family: var(--font-latin);
		font-size: 0.68rem;
		font-weight: 700;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	.ranges {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.sort :global(.seg) {
		flex-wrap: wrap;
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.panel-foot {
		padding: var(--sp-4);
		border-block-start: 1px solid var(--border);
		background: var(--surface-1);
	}
</style>
