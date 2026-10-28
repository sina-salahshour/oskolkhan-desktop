<script lang="ts">
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { digits } from '$lib/util/format';

	interface Props {
		value: number;
		duration?: number;
		format?: (n: number) => string;
		class?: string;
	}
	let { value, duration = 900, format, class: cls = '' }: Props = $props();

	const reduce =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	const tween = new Tween(
		untrack(() => value),
		{
			duration: reduce ? 0 : untrack(() => duration),
			easing: cubicOut
		}
	);

	$effect(() => {
		tween.target = value;
	});

	let shown = $derived(Math.round(tween.current));
	let text = $derived(format ? format(shown) : digits(shown));
</script>

<span class="num latin {cls}">{text}</span>

<style>
	.num {
		font-variant-numeric: tabular-nums;
	}
</style>
