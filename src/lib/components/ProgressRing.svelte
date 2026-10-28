<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		/** 0..1 */
		value: number;
		size?: number;
		stroke?: number;
		tone?: string;
		track?: string;
		children?: Snippet;
	}
	let {
		value,
		size = 96,
		stroke = 8,
		tone = 'var(--accent)',
		track = 'var(--surface-3)',
		children
	}: Props = $props();

	const reduce =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	const tween = new Tween(0, { duration: reduce ? 0 : 1100, easing: cubicOut });

	$effect(() => {
		tween.target = Math.max(0, Math.min(1, value));
	});

	let r = $derived((size - stroke) / 2);
	let circ = $derived(2 * Math.PI * r);
	let dash = $derived(circ * tween.current);
</script>

<div class="ring" style="inline-size:{size}px;block-size:{size}px">
	<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
		<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={track} stroke-width={stroke} />
		<circle
			class="arc"
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke={tone}
			stroke-width={stroke}
			stroke-linecap="round"
			stroke-dasharray="{dash} {circ}"
			transform="rotate(-90 {size / 2} {size / 2})"
		/>
	</svg>
	{#if children}<div class="center">{@render children()}</div>{/if}
</div>

<style>
	.ring {
		position: relative;
		display: inline-grid;
		place-items: center;
	}
	svg {
		filter: drop-shadow(0 0 6px var(--accent-glow));
	}
	.center {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		text-align: center;
	}
</style>
