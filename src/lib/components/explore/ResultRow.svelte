<script lang="ts">
	import type { GenericTitle } from '$lib/api';
	import { ui } from '$lib/stores/ui.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { poster } from '$lib/util/images';
	import { year, rankText, compact, digits } from '$lib/util/format';
	import { isSeries } from '$lib/util/enums';
	import Poster from '$lib/components/Poster.svelte';
	import Icon from '$lib/components/Icon.svelte';

	interface Props {
		title: GenericTitle;
	}
	let { title }: Props = $props();

	let name = $derived(
		ui.titleLang === 'original' ? title.titles[0] || title.persian : title.persian
	);
	let sub = $derived(ui.titleLang === 'original' ? title.persian : title.titles[0] || '');
	let href = $derived(`/title/${title.id}`);
	let genreNames = $derived(preload.genres(title.genres).slice(0, 3));
	let epLabel = $derived(
		isSeries(title) && title.S ? `S${digits(title.S)}·E${digits(title.E || '1')}` : ''
	);
</script>

<a class="row" {href} aria-label={name}>
	<div class="thumb">
		<Poster src={poster(title.img)} alt={name} seed={title.id} label={name} />
	</div>
	<div class="body">
		<div class="top">
			<p class="name" title={name}>{name}</p>
			{#if title.rank > 0}
				<span class="rank latin"><Icon name="star-filled" size={13} />{rankText(title.rank)}</span>
			{/if}
		</div>
		<p class="meta">
			{#if sub}<span class="st">{sub}</span><span class="dot">·</span>{/if}
			{#if title.Year}<span class="latin">{year(title.Year)}</span>{/if}
			{#if epLabel}<span class="dot">·</span><span class="latin">{epLabel}</span>{/if}
			{#if title.votes > 0}<span class="dot">·</span><span class="latin"
					>{compact(title.votes)}</span
				>{/if}
		</p>
		{#if genreNames.length}
			<p class="genres">{genreNames.join(' · ')}</p>
		{/if}
		{#if title.Description}
			<p class="desc">{title.Description}</p>
		{/if}
	</div>
	<span class="chev" aria-hidden="true"><Icon name="chevron-left" size={18} /></span>
</a>

<style>
	.row {
		display: flex;
		align-items: stretch;
		gap: var(--sp-4);
		padding: var(--sp-3);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
		transition:
			border-color var(--dur) var(--ease),
			background var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}
	.row:hover {
		border-color: var(--border-strong);
		background: var(--surface-2);
		transform: translateY(-2px);
	}
	.row:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-color: var(--border-accent);
	}
	.thumb {
		inline-size: 64px;
		flex: none;
	}
	.body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-inline-size: 0;
		flex: 1;
	}
	.top {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.name {
		font-size: 1rem;
		font-weight: 700;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-inline-size: 0;
	}
	.rank {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-inline-start: auto;
		color: var(--accent);
		font-weight: 700;
		font-size: 0.82rem;
		flex: none;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.st {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-inline-size: 50%;
	}
	.dot {
		color: var(--text-dim);
	}
	.genres {
		font-size: 0.78rem;
		color: var(--accent-strong);
	}
	.desc {
		font-size: 0.82rem;
		color: var(--text-dim);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.chev {
		display: grid;
		place-items: center;
		color: var(--text-dim);
		flex: none;
		transition:
			transform var(--dur) var(--ease-out),
			color var(--dur) var(--ease);
	}
	/* chevron-left points toward the inline-end in RTL; nudge along that direction */
	.row:hover .chev,
	.row:focus-visible .chev {
		color: var(--accent);
		transform: translateX(-4px);
	}
	:global([dir='ltr']) .row:hover .chev,
	:global([dir='ltr']) .row:focus-visible .chev {
		transform: translateX(4px);
	}
</style>
