<script lang="ts">
	import { placeholderGradient } from '$lib/util/images';

	interface Props {
		src?: string;
		alt: string;
		seed: string | number;
		/** initials / short label to show on the gradient fallback */
		label?: string;
		ratio?: string;
		rounded?: string;
		class?: string;
	}
	let {
		src = '',
		alt,
		seed,
		label = '',
		ratio = '2 / 3',
		rounded = 'var(--r-md)',
		class: cls = ''
	}: Props = $props();

	let failed = $state(false);
	let loaded = $state(false);
	let showImg = $derived(src !== '' && !failed);
	let gradient = $derived(placeholderGradient(seed));
</script>

<div
	class="poster {cls}"
	style="aspect-ratio:{ratio};border-radius:{rounded};background:{gradient}"
>
	{#if showImg}
		<img
			{src}
			{alt}
			class:loaded
			loading="lazy"
			decoding="async"
			onload={() => (loaded = true)}
			onerror={() => (failed = true)}
		/>
	{/if}
	{#if !loaded && label}
		<span class="fallback">{label}</span>
	{/if}
	<span class="sheen" aria-hidden="true"></span>
</div>

<style>
	.poster {
		position: relative;
		inline-size: 100%;
		overflow: hidden;
		isolation: isolate;
	}
	img {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity var(--dur-slow) var(--ease);
	}
	img.loaded {
		opacity: 1;
	}
	.fallback {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: var(--sp-3);
		text-align: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1rem;
		color: color-mix(in srgb, var(--text) 82%, transparent);
		text-shadow: 0 1px 10px rgba(0, 0, 0, 0.5);
	}
	.sheen {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, transparent 55%, rgba(0, 0, 0, 0.35));
		pointer-events: none;
	}
</style>
