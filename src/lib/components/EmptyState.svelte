<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';
	interface Props {
		icon?: IconName;
		title: string;
		description?: string;
		action?: Snippet;
	}
	let { icon = 'film', title, description, action }: Props = $props();
</script>

<div class="empty">
	<div class="orb"><Icon name={icon} size={28} /></div>
	<p class="t">{title}</p>
	{#if description}<p class="d">{description}</p>{/if}
	{#if action}<div class="a">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: var(--sp-3);
		padding-block: var(--sp-8);
		color: var(--text-muted);
	}
	.orb {
		inline-size: 68px;
		block-size: 68px;
		display: grid;
		place-items: center;
		border-radius: var(--r-full);
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-dim);
		margin-block-end: var(--sp-2);
	}
	.t {
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--text);
	}
	.d {
		max-inline-size: 360px;
		font-size: 0.9rem;
	}
	.a {
		margin-block-start: var(--sp-3);
	}
</style>
