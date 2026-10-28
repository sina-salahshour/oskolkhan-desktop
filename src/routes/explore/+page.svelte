<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$lib/api';
	import type { GetMore, GenericTitle, AdvanceFiler, Relaxation } from '$lib/api';
	import { t } from '$lib/i18n';
	import { status } from '$lib/stores/status.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { digits } from '$lib/util/format';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import TitleCard from '$lib/components/TitleCard.svelte';
	import FilterPanel from '$lib/components/explore/FilterPanel.svelte';
	import ResultRow from '$lib/components/explore/ResultRow.svelte';

	// ---- results state ----------------------------------------------------
	let items = $state<GenericTitle[]>([]);
	let total = $state(0);
	let hasmove = $state(false);
	let relaxed = $state<string[]>([]);
	let relaxations = $state<Relaxation[]>([]);

	let filter = $state<Partial<AdvanceFiler>>({});
	let pageNum = $state(1);

	let loading = $state(true);
	let loadingMore = $state(false);
	let failed = $state(false);

	let view = $state<'grid' | 'list'>('grid');
	let panelOpen = $state(false);

	const viewOptions = [
		{ value: 'grid' as const, icon: 'grid' as const, label: t('explore.gridView') },
		{ value: 'list' as const, icon: 'list' as const, label: t('explore.listView') }
	];

	let endpoint = $derived(page.url.searchParams.get('more') || 'filter');
	let hasRelaxation = $derived(relaxed.length > 0 || relaxations.length > 0);

	// ---- data loading -----------------------------------------------------
	async function load(reset: boolean) {
		if (reset) {
			pageNum = 1;
			loading = true;
		} else {
			loadingMore = true;
		}
		failed = false;
		try {
			const res: GetMore = await api.getMore({ endpoint, page: pageNum, filter });
			items = reset ? res.items : [...items, ...res.items];
			total = res.total;
			hasmove = res.hasmove;
			relaxed = res.relaxed;
			relaxations = res.relaxations;
		} catch {
			if (reset) {
				failed = true;
				items = [];
			}
		} finally {
			loading = false;
			loadingMore = false;
		}
	}

	function loadMore() {
		pageNum += 1;
		load(false);
	}

	function onFilterChange(next: Partial<AdvanceFiler>) {
		filter = next;
		load(true);
	}

	// Initial load once the core is ready; reload when the endpoint changes.
	let lastKey = '';
	$effect(() => {
		if (!status.ready) return;
		const key = endpoint;
		if (key !== lastKey) {
			lastKey = key;
			load(true);
		}
	});

	// Make sure the lookup tables for genre/country chips are warmed.
	$effect(() => {
		if (status.ready) preload.init();
	});

	function facetLabel(facet: string): string {
		const key = `explore.${facet.split('.').pop() ?? facet}`;
		const label = t(key);
		return label === key ? facet : label;
	}
</script>

<div class="page">
	<div class="head">
		<h1 class="section-title">
			<Icon name="compass" size={22} />
			<span>{t('explore.title')}</span>
		</h1>
		<div class="filter-toggle">
			<Button
				variant="outline"
				icon="sliders"
				active={panelOpen}
				onclick={() => (panelOpen = !panelOpen)}
			>
				{t('common.filter')}
			</Button>
		</div>
	</div>

	<div class="layout" class:panel-open={panelOpen}>
		<aside class="panel-col">
			<div class="panel-sticky">
				<FilterPanel onchange={onFilterChange} />
			</div>
		</aside>

		<section class="results">
			<header class="results-head">
				<div class="count">
					<span class="num latin">{digits(total)}</span>
					<span class="lbl">{t('explore.results')}</span>
				</div>
				<div class="seg">
					{#each viewOptions as opt (opt.value)}
						<button
							type="button"
							class:active={view === opt.value}
							aria-label={opt.label}
							title={opt.label}
							onclick={() => (view = opt.value)}
						>
							<Icon name={opt.icon} size={17} />
						</button>
					{/each}
				</div>
			</header>

			{#if hasRelaxation}
				<div class="relax" role="status">
					<div class="relax-top">
						<Icon name="info" size={16} />
						<span>{t('explore.relaxedNotice')}</span>
					</div>
					{#if relaxations.length}
						<div class="relax-hints">
							{#each relaxations as r (r.facet)}
								<span class="hint">
									<Badge tone="gold">{facetLabel(r.facet)}</Badge>
									<span class="hint-text">{t('explore.relaxHint', { n: r.wouldBe })}</span>
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if loading}
				<div class="grid">
					{#each Array(12) as _, i (i)}
						<div class="sk-cell">
							<Skeleton height="230px" radius="var(--r-md)" />
							<Skeleton width="80%" height="0.8rem" />
							<Skeleton width="55%" height="0.7rem" />
						</div>
					{/each}
				</div>
			{:else if failed}
				<ErrorState onretry={() => load(true)} />
			{:else if items.length === 0}
				<EmptyState icon="compass" title={t('explore.noResults')} />
			{:else}
				{#if view === 'grid'}
					<div class="grid">
						{#each items as item (item.id)}
							<TitleCard title={item} />
						{/each}
					</div>
				{:else}
					<div class="list">
						{#each items as item (item.id)}
							<ResultRow title={item} />
						{/each}
					</div>
				{/if}

				{#if hasmove}
					<div class="more">
						<Button
							variant="outline"
							size="lg"
							icon="chevron-down"
							loading={loadingMore}
							onclick={loadMore}
						>
							{t('explore.loadMore')}
						</Button>
					</div>
				{/if}
			{/if}

			{#if loadingMore && items.length}
				<div class="more-spin"><Spinner size={22} label={t('common.loading')} /></div>
			{/if}
		</section>
	</div>
</div>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
		margin-block-end: var(--sp-5);
	}
	.head .section-title {
		font-size: 1.4rem;
	}

	.layout {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: var(--sp-5);
		align-items: start;
	}

	.panel-sticky {
		position: sticky;
		inset-block-start: var(--sp-5);
		max-block-size: calc(100vh - var(--sp-7));
		display: flex;
	}
	.panel-sticky :global(.panel) {
		max-block-size: calc(100vh - var(--sp-7));
		inline-size: 100%;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		min-inline-size: 0;
	}
	.results-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
	}
	.count {
		display: inline-flex;
		align-items: baseline;
		gap: var(--sp-2);
	}
	.count .num {
		font-size: 1.3rem;
		font-weight: 800;
		color: var(--accent);
	}
	.count .lbl {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.seg {
		display: inline-flex;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 3px;
		gap: 2px;
	}
	.seg button {
		display: inline-grid;
		place-items: center;
		inline-size: 34px;
		block-size: 30px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		border-radius: var(--r-sm);
		transition: all var(--dur-fast) var(--ease);
	}
	.seg button:hover {
		color: var(--text);
	}
	.seg button.active {
		background: var(--surface-hover);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}

	.relax {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4);
		border: 1px solid var(--border-accent);
		background: var(--accent-soft);
		border-radius: var(--r-md);
	}
	.relax-top {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--accent-strong);
	}
	.relax-hints {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
	}
	.hint {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.hint-text {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--sp-4);
	}
	.sk-cell {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.more {
		display: flex;
		justify-content: center;
		padding-block: var(--sp-4);
	}
	.more-spin {
		display: flex;
		justify-content: center;
		padding-block: var(--sp-3);
	}

	/* The filter toggle is for narrow layouts only. */
	.filter-toggle {
		display: none;
	}

	@media (max-width: 1024px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.panel-col {
			display: none;
		}
		.layout.panel-open .panel-col {
			display: block;
		}
		.panel-sticky {
			position: static;
			max-block-size: none;
		}
		.panel-sticky :global(.panel) {
			max-block-size: none;
		}
		.filter-toggle {
			display: inline-flex;
		}
	}
</style>
