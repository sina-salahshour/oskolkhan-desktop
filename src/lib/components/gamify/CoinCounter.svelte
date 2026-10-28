<script lang="ts">
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { digits } from '$lib/util/format';
	import Icon from '../Icon.svelte';
	import AnimatedNumber from '../AnimatedNumber.svelte';

	interface Props {
		coins: number;
		size?: 'sm' | 'md' | 'lg';
	}
	let { coins, size = 'md' }: Props = $props();

	interface Flyup {
		id: number;
		amount: number;
	}
	let flyups = $state<Flyup[]>([]);
	let prev = untrack(() => coins);
	let nextId = 0;

	$effect(() => {
		const delta = coins - prev;
		prev = coins;
		if (delta > 0) {
			const id = nextId++;
			flyups = [...flyups, { id, amount: delta }];
			setTimeout(() => {
				flyups = flyups.filter((f) => f.id !== id);
			}, 1100);
		}
	});
</script>

<span class="coin {size}">
	<span class="ic"><Icon name="coin" size={size === 'lg' ? 26 : size === 'sm' ? 16 : 20} /></span>
	<AnimatedNumber value={coins} />
	{#each flyups as f (f.id)}
		<span class="flyup latin" out:fly={{ y: -34, duration: 1000 }}>+{digits(f.amount)}</span>
	{/each}
</span>

<style>
	.coin {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		font-weight: 800;
		color: var(--coin);
		line-height: 1;
	}
	.sm {
		font-size: 0.95rem;
	}
	.md {
		font-size: 1.25rem;
	}
	.lg {
		font-size: 1.9rem;
	}
	.ic {
		display: grid;
		place-items: center;
		filter: drop-shadow(0 0 6px var(--coin-glow));
	}
	.flyup {
		position: absolute;
		inset-block-start: -4px;
		inset-inline-end: -8px;
		font-size: 0.85rem;
		font-weight: 800;
		color: var(--coin);
		text-shadow: 0 0 10px var(--coin-glow);
		pointer-events: none;
	}
</style>
