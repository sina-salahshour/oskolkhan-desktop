<script lang="ts">
	import type { GenericTitle } from '$lib/api';
	import { t } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import { backdrop, placeholderGradient } from '$lib/util/images';
	import { year, rankText, compact } from '$lib/util/format';
	import { preload } from '$lib/stores/preload.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import { fade, fly } from 'svelte/transition';

	interface Props {
		items: GenericTitle[];
	}
	let { items }: Props = $props();

	let index = $state(0);
	let current = $derived(items[index] ?? items[0]);
	let name = $derived(
		current
			? ui.titleLang === 'original'
				? current.titles[0] || current.persian
				: current.persian
			: ''
	);
	let genres = $derived(current ? preload.genres(current.genres).slice(0, 3) : []);

	let timer: ReturnType<typeof setInterval> | null = null;
	$effect(() => {
		if (items.length <= 1) return;
		timer = setInterval(() => {
			index = (index + 1) % items.length;
		}, 7000);
		return () => {
			if (timer) clearInterval(timer);
		};
	});

	function goto(i: number) {
		index = (i + items.length) % items.length;
	}
</script>

{#if current}
	<section class="hero">
		{#key current.id}
			<div
				class="bg"
				style="background-image:{current.img
					? `url(${backdrop(current.img)}), ${placeholderGradient(current.id)}`
					: placeholderGradient(current.id)}"
			></div>
		{/key}
		<div class="veil"></div>

		{#key current.id}
			<div class="content" in:fly={{ y: 14, duration: 250 }} out:fade={{ duration: 120 }}>
				<span class="kicker"><Icon name="star-filled" size={14} />{t('home.hero.badge')}</span>
				<h2 class="title">{name}</h2>
				<div class="facts latin">
					{#if current.rank > 0}
						<span class="rank"><Icon name="star-filled" size={14} />{rankText(current.rank)}</span>
					{/if}
					{#if current.Year}<span>{year(current.Year)}</span>{/if}
					{#if current.votes}<span>{compact(current.votes)}</span>{/if}
				</div>
				{#if genres.length}
					<p class="genres">{genres.join(' · ')}</p>
				{/if}
				<p class="desc">{current.Description}</p>
				<div class="cta">
					<Button variant="primary" size="lg" icon="play-filled" href={`/player?id=${current.id}`}>
						{t('common.play')}
					</Button>
					<Button variant="secondary" size="lg" icon="info" href={`/title/${current.id}`}>
						{t('common.more')}
					</Button>
				</div>
			</div>
		{/key}

		{#if items.length > 1}
			<div class="dots">
				{#each items as it, i (`${it.id}-${i}`)}
					<button
						class="dot"
						class:on={i === index}
						aria-label={`slide ${i + 1}`}
						onclick={() => goto(i)}
					></button>
				{/each}
			</div>
		{/if}
	</section>
{/if}

<style>
	.hero {
		position: relative;
		border-radius: var(--r-xl);
		overflow: hidden;
		min-block-size: 440px;
		display: flex;
		align-items: flex-end;
		margin-block-end: var(--sp-6);
		box-shadow: var(--shadow-md);
		isolation: isolate;
	}
	.bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		animation: zoom 12s ease-out forwards;
	}
	@keyframes zoom {
		from {
			transform: scale(1.08);
		}
		to {
			transform: scale(1);
		}
	}
	.veil {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(
				to top,
				var(--bg) 2%,
				color-mix(in srgb, var(--bg) 40%, transparent) 40%,
				transparent 70%
			),
			linear-gradient(to left, transparent 40%, color-mix(in srgb, var(--bg) 70%, transparent));
	}
	:global([dir='ltr']) .veil {
		background:
			linear-gradient(
				to top,
				var(--bg) 2%,
				color-mix(in srgb, var(--bg) 40%, transparent) 40%,
				transparent 70%
			),
			linear-gradient(to right, transparent 40%, color-mix(in srgb, var(--bg) 70%, transparent));
	}
	.content {
		position: relative;
		padding: var(--sp-7);
		max-inline-size: 640px;
	}
	.kicker {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--accent);
		font-weight: 700;
		font-size: 0.82rem;
		letter-spacing: 0.02em;
		margin-block-end: var(--sp-3);
	}
	.title {
		font-size: clamp(2rem, 4vw, 3rem);
		line-height: 1.05;
		margin-block-end: var(--sp-3);
		text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
	}
	.facts {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		color: var(--text-muted);
		font-weight: 600;
		margin-block-end: var(--sp-2);
	}
	.rank {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--accent);
	}
	.genres {
		color: var(--text-muted);
		margin-block-end: var(--sp-3);
		font-size: 0.92rem;
	}
	.desc {
		color: var(--text);
		opacity: 0.9;
		line-height: 1.7;
		margin-block-end: var(--sp-5);
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.cta {
		display: flex;
		gap: var(--sp-3);
	}
	.dots {
		position: absolute;
		inset-block-end: var(--sp-5);
		inset-inline-end: var(--sp-7);
		display: flex;
		gap: var(--sp-2);
	}
	.dot {
		cursor: pointer;
		inline-size: 9px;
		block-size: 9px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		border: none;
		transition:
			inline-size var(--dur) var(--ease-spring),
			background var(--dur) var(--ease);
	}
	.dot:hover:not(.on) {
		background: rgba(255, 255, 255, 0.55);
	}
	.dot:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.dot.on {
		inline-size: 26px;
		border-radius: var(--r-full);
		background: var(--accent);
	}
</style>
