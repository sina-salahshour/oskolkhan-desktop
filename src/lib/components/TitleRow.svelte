<script lang="ts">
	import type { GenericTitle } from '$lib/api';
	import { i18n, t } from '$lib/i18n';
	import TitleCard from './TitleCard.svelte';
	import Skeleton from './Skeleton.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		items: GenericTitle[];
		loading?: boolean;
		moreHref?: string;
		progressFor?: (t: GenericTitle) => number | undefined;
	}
	let { title, items, loading = false, moreHref, progressFor }: Props = $props();

	let scroller = $state<HTMLDivElement | null>(null);

	function nudge(dir: 1 | -1) {
		if (!scroller) return;
		const amount = Math.round(scroller.clientWidth * 0.8) * dir * (i18n.isRtl ? -1 : 1);
		scroller.scrollBy({ left: amount, behavior: 'smooth' });
	}
</script>

<section class="row">
	<header>
		<h2 class="section-title">{title}</h2>
		<div class="ctl">
			{#if moreHref}
				<a class="more" href={moreHref}
					>{t('common.seeAll')}<Icon name="chevron-left" size={15} /></a
				>
			{/if}
			<button class="nav" aria-label="prev" onclick={() => nudge(-1)}>
				<Icon name="chevron-right" size={18} />
			</button>
			<button class="nav" aria-label="next" onclick={() => nudge(1)}>
				<Icon name="chevron-left" size={18} />
			</button>
		</div>
	</header>

	<div class="scroller" bind:this={scroller}>
		{#if loading}
			{#each Array(6) as _, i (i)}
				<div class="cell">
					<Skeleton height="auto" />
					<div class="shell"><Skeleton width="80%" height="0.8rem" /></div>
				</div>
			{/each}
		{:else}
			{#each items as item (item.id)}
				<div class="cell">
					<TitleCard title={item} progress={progressFor?.(item)} />
				</div>
			{/each}
		{/if}
	</div>
</section>

<style>
	.row {
		margin-block-end: var(--sp-6);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-block-end: var(--sp-4);
		gap: var(--sp-3);
	}
	.ctl {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.more {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-muted);
		padding-inline: var(--sp-2);
	}
	.more:hover {
		color: var(--accent);
	}
	.nav {
		inline-size: 34px;
		block-size: 34px;
		display: grid;
		place-items: center;
		border-radius: var(--r-full);
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-muted);
		transition: all var(--dur-fast) var(--ease);
	}
	.nav:hover {
		background: var(--surface-hover);
		color: var(--text);
	}
	.scroller {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: clamp(130px, 14vw, 172px);
		gap: var(--sp-4);
		overflow-x: auto;
		scroll-snap-type: x proximity;
		padding-block-end: var(--sp-2);
		scrollbar-width: none;
	}
	.scroller::-webkit-scrollbar {
		display: none;
	}
	.cell {
		scroll-snap-align: start;
	}
	.shell {
		margin-block-start: var(--sp-2);
	}
	.cell :global(.skeleton) {
		aspect-ratio: 2 / 3;
	}
</style>
