<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$lib/api';
	import type { ISearch } from '$lib/api';
	import { t } from '$lib/i18n';
	import { digits } from '$lib/util/format';
	import { person, placeholderGradient } from '$lib/util/images';
	import Field from '$lib/components/Field.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import TitleCard from '$lib/components/TitleCard.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { errorText } from '$lib/util/err';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Chip from '$lib/components/Chip.svelte';

	const initial = page.url.searchParams.get('q') ?? '';
	let query = $state(initial);
	let type = $state(0);
	let phrase = $state(initial.trim());
	let result = $state<ISearch | null>(null);
	let loading = $state(false);
	let error = $state('');
	let seq = 0;

	// debounce typing into `phrase`
	$effect(() => {
		const q = query.trim();
		const id = setTimeout(() => (phrase = q), 300);
		return () => clearTimeout(id);
	});

	async function run(p: string, ty: number) {
		const mine = ++seq;
		if (!p) {
			result = null;
			loading = false;
			error = '';
			return;
		}
		loading = true;
		error = '';
		try {
			const res = await api.search({ phrase: p, type: ty, ignoreTypes: 0, page: 0 });
			if (mine === seq) result = res;
		} catch (e) {
			if (mine === seq) error = errorText(e);
		} finally {
			if (mine === seq) loading = false;
		}
	}

	$effect(() => {
		run(phrase, type);
	});

	let hasResults = $derived(
		!!result && (result.Titles.length > 0 || result.People.length > 0 || result.Keywords.length > 0)
	);
	let failed = $state<Record<number, boolean>>({});
</script>

<div class="page">
	<div class="bar">
		<div class="field">
			<Field
				type="search"
				icon="search"
				autofocus
				placeholder={t('search.placeholder')}
				bind:value={query}
				onenter={() => (phrase = query.trim())}
			/>
		</div>
		<SegmentedControl
			options={[
				{ value: 0, label: t('common.all') },
				{ value: 1, label: t('common.movie') },
				{ value: 2, label: t('common.series') }
			]}
			bind:value={type}
		/>
	</div>

	{#if !phrase}
		<EmptyState icon="search" title={t('search.empty')} />
	{:else if loading && !result}
		<div class="grid">
			{#each Array(10) as _, i (i)}
				<div class="sk">
					<Skeleton height="225px" />
					<Skeleton height="0.9rem" width="70%" />
				</div>
			{/each}
		</div>
	{:else if error}
		<ErrorState message={error} onretry={() => run(phrase, type)} />
	{:else if result && !hasResults}
		<EmptyState icon="search" title={t('search.noResults', { q: phrase })} />
	{:else if result}
		<div class="results" class:dim={loading}>
			{#if result.Titles.length}
				<section>
					<h2 class="section-title">{t('search.titles')}</h2>
					<div class="grid">
						{#each result.Titles as title, i (`${title.id}-${i}`)}
							<div class="stagger-in" style="--i:{Math.min(i, 12)}">
								<TitleCard {title} />
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if result.People.length}
				<section>
					<h2 class="section-title">{t('search.people')}</h2>
					<div class="people">
						{#each result.People as p, i (`${p.id}-${i}`)}
							{@const src = person(p.img)}
							<div class="person stagger-in" style="--i:{Math.min(i, 12)}">
								<div class="avatar" style:background={placeholderGradient(p.id)}>
									{#if src && !failed[p.id]}
										<img
											{src}
											alt={p.title1}
											loading="lazy"
											onerror={() => (failed[p.id] = true)}
										/>
									{:else}
										<span>{p.title1.slice(0, 1)}</span>
									{/if}
								</div>
								<p class="pname">{p.title1}</p>
								<p class="prole">{p.title2}</p>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if result.Keywords.length}
				<section>
					<h2 class="section-title">{t('search.keywords')}</h2>
					<div class="chips">
						{#each result.Keywords as k (k.id)}
							<Chip onclick={() => (query = k.title1)}>
								{k.title1}
								{#if k.title2}<span class="kc">{digits(k.title2)}</span>{/if}
							</Chip>
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
		margin-block-end: var(--sp-6);
	}
	.field {
		flex: 1;
		min-inline-size: 260px;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--sp-8);
		transition: opacity var(--dur) var(--ease);
	}
	.results.dim {
		opacity: 0.55;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--sp-4);
	}
	.sk {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.people {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: var(--sp-4);
	}
	.person {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--sp-1);
	}
	.avatar {
		inline-size: 84px;
		block-size: 84px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		border: 2px solid var(--border);
		color: var(--accent);
		font-weight: 700;
		font-size: 1.5rem;
		margin-block-end: var(--sp-2);
		transition:
			transform var(--dur) var(--ease-spring),
			border-color var(--dur) var(--ease);
	}
	.person:hover .avatar {
		transform: scale(1.06);
		border-color: var(--border-accent);
	}
	.avatar img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}
	.pname {
		font-weight: 600;
		font-size: 0.88rem;
	}
	.prole {
		color: var(--text-muted);
		font-size: 0.76rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	.kc {
		color: var(--text-dim);
		margin-inline-start: var(--sp-1);
	}
</style>
