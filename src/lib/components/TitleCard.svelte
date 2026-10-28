<script lang="ts">
	import type { GenericTitle } from '$lib/api';
	import { ui } from '$lib/stores/ui.svelte';
	import { poster } from '$lib/util/images';
	import { year, rankText, digits } from '$lib/util/format';
	import { titleQualityBadges, isSeries } from '$lib/util/enums';
	import Poster from './Poster.svelte';
	import Badge from './Badge.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: GenericTitle;
		/** 0..1 watch progress for continue-watching */
		progress?: number;
	}
	let { title, progress }: Props = $props();

	let name = $derived(
		ui.titleLang === 'original' ? title.titles[0] || title.persian : title.persian
	);
	let sub = $derived(ui.titleLang === 'original' ? title.persian : title.titles[0] || '');
	let badges = $derived(titleQualityBadges(title).slice(0, 2));
	let href = $derived(`/title/${title.id}`);
	let epLabel = $derived(
		isSeries(title) && title.S ? `S${digits(title.S)}·E${digits(title.E || '1')}` : ''
	);
</script>

<a class="card" {href} aria-label={name}>
	<div class="art">
		<Poster src={poster(title.img)} alt={name} seed={title.id} label={name} />
		<div class="overlay">
			<span class="play"><Icon name="play-filled" size={20} /></span>
		</div>
		{#if title.rank > 0}
			<div class="rank"><Icon name="star-filled" size={12} />{rankText(title.rank)}</div>
		{/if}
		{#if badges.length}
			<div class="badges">
				{#each badges as b (b.label)}
					<Badge tone={b.tone}>{b.label}</Badge>
				{/each}
			</div>
		{/if}
		{#if epLabel}
			<div class="ep latin">{epLabel}</div>
		{/if}
		{#if progress !== undefined}
			<div class="bar"><span style="inline-size:{Math.round(progress * 100)}%"></span></div>
		{/if}
	</div>
	<div class="meta">
		<p class="name" title={name}>{name}</p>
		<p class="sub">
			{#if sub}<span class="st">{sub}</span>{/if}
			{#if title.Year}<span class="yr latin">{year(title.Year)}</span>{/if}
		</p>
	</div>
</a>

<style>
	.card {
		display: block;
		inline-size: 100%;
	}
	.art {
		position: relative;
		border-radius: var(--r-md);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		transition:
			transform var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	.card:hover .art {
		transform: translateY(-4px);
		box-shadow: var(--shadow-md);
	}
	.overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: linear-gradient(0deg, rgba(0, 0, 0, 0.5), transparent 60%);
		opacity: 0;
		transition: opacity var(--dur) var(--ease);
	}
	.card:hover .overlay {
		opacity: 1;
	}
	.play {
		inline-size: 46px;
		block-size: 46px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 6px 20px var(--accent-glow);
		transform: scale(0.8);
		transition: transform var(--dur) var(--ease);
	}
	.card:hover .play {
		transform: scale(1);
	}
	.rank {
		position: absolute;
		inset-block-start: var(--sp-2);
		inset-inline-start: var(--sp-2);
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding-inline: 7px;
		padding-block: 3px;
		border-radius: var(--r-xs);
		background: var(--scrim);
		color: var(--accent);
		font-family: var(--font-latin);
		font-weight: 700;
		font-size: 0.72rem;
		backdrop-filter: blur(6px);
	}
	.badges {
		position: absolute;
		inset-block-start: var(--sp-2);
		inset-inline-end: var(--sp-2);
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-end;
	}
	.ep {
		position: absolute;
		inset-block-end: var(--sp-2);
		inset-inline-start: var(--sp-2);
		padding-inline: 6px;
		padding-block: 2px;
		border-radius: var(--r-xs);
		background: var(--scrim);
		font-size: 0.68rem;
		font-weight: 700;
		backdrop-filter: blur(6px);
	}
	.bar {
		position: absolute;
		inset-block-end: 0;
		inset-inline: 0;
		block-size: 3px;
		background: rgba(0, 0, 0, 0.5);
	}
	.bar span {
		display: block;
		block-size: 100%;
		background: var(--accent);
	}
	.meta {
		margin-block-start: var(--sp-2);
	}
	.name {
		font-size: 0.9rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sub {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: 0.76rem;
		color: var(--text-dim);
		margin-block-start: 2px;
	}
	.st {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.yr {
		margin-inline-start: auto;
	}
</style>
