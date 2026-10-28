<script lang="ts">
	import { api } from '$lib/api';
	import type { Home, GenericTitle } from '$lib/api';
	import { t } from '$lib/i18n';
	import { status } from '$lib/stores/status.svelte';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';
	import TitleRow from '$lib/components/TitleRow.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';

	let data = $state<Home | null>(null);
	let loading = $state(true);
	let failed = $state(false);

	async function load() {
		loading = true;
		failed = false;
		try {
			data = await api.home(0);
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	// Load once the core is ready (mock is ready almost immediately).
	$effect(() => {
		if (status.ready && !data && loading) load();
	});

	let hero = $derived(data?.sections.find((s) => s.type === 0)?.recently ?? []);
	let rows = $derived(data?.sections.filter((s) => s.type !== 0) ?? []);

	function progressFor(section: number) {
		return section === 1 ? (tt: GenericTitle) => 0.3 + (tt.id % 5) * 0.12 : undefined;
	}
</script>

<div class="page">
	{#if loading}
		<Skeleton height="440px" radius="var(--r-xl)" />
		<div class="rowsk">
			{#each Array(3) as _, i (i)}
				<Skeleton width="220px" height="1.2rem" />
				<div class="cards">
					{#each Array(6) as _, j (j)}
						<Skeleton height="230px" />
					{/each}
				</div>
			{/each}
		</div>
	{:else if failed}
		<ErrorState onretry={load} />
	{:else if data}
		{#if hero.length}
			<HeroCarousel items={hero} />
		{/if}
		{#each rows as section, i (`${section.id}-${i}`)}
			<div class="stagger-in" style="--i:{Math.min(i, 12)}">
				<TitleRow
					title={section.title}
					items={section.recently}
					moreHref={section.hasmore ? `/explore?more=${section.moreendpoint}` : undefined}
					progressFor={progressFor(section.type)}
				/>
			</div>
		{/each}
		{#if rows.length === 0 && hero.length === 0}
			<p class="empty muted">{t('home.empty')}</p>
		{/if}
	{/if}
</div>

<style>
	.rowsk {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		margin-block-start: var(--sp-6);
	}
	.cards {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--sp-4);
	}
	.empty {
		text-align: center;
		padding-block: var(--sp-8);
	}
</style>
