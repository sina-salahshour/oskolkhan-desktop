<script lang="ts">
	import { Accordion as MeltAccordion } from 'melt/builders';
	import { slide } from 'svelte/transition';
	import Icon from './Icon.svelte';

	interface Item {
		id: string;
		q: string;
		a: string;
	}
	interface Props {
		items: Item[];
	}
	let { items }: Props = $props();

	// Melt owns expand/collapse state, keyboard nav, and aria wiring.
	const acc = new MeltAccordion();
</script>

<div {...acc.root} class="acc">
	{#each items as item (item.id)}
		{@const i = acc.getItem({ id: item.id })}
		<div class="row" class:open={i.isExpanded}>
			<button {...i.trigger} class="q">
				<span>{item.q}</span>
				<span class="chev" class:open={i.isExpanded}><Icon name="chevron-down" size={18} /></span>
			</button>
			{#if i.isExpanded}
				<div {...i.content} class="a" transition:slide={{ duration: 200 }}>
					<p>{item.a}</p>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.acc {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.row {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		overflow: hidden;
		transition: border-color var(--dur) var(--ease);
	}
	.row.open {
		border-color: var(--accent);
	}
	.q {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		inline-size: 100%;
		padding: var(--sp-4);
		text-align: start;
		color: var(--text);
		font-weight: 600;
		background: transparent;
		border: none;
		transition: background var(--dur-fast) var(--ease);
	}
	.q:hover {
		background: var(--surface-2);
	}
	.chev {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		color: var(--text-dim);
		transition:
			transform var(--dur) var(--ease),
			color var(--dur) var(--ease);
	}
	.chev.open {
		transform: rotate(180deg);
		color: var(--accent);
	}
	.a {
		padding-inline: var(--sp-4);
		padding-block: 0 var(--sp-4);
		color: var(--text-muted);
		line-height: 1.7;
	}
</style>
