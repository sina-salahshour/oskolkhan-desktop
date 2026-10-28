<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	interface Props {
		selected?: boolean;
		removable?: boolean;
		onclick?: () => void;
		onremove?: () => void;
		children: Snippet;
	}
	let { selected = false, removable = false, onclick, onremove, children }: Props = $props();
</script>

<button class="chip" class:selected type="button" {onclick}>
	<span>{@render children()}</span>
	{#if removable && selected}
		<span
			class="rm"
			role="button"
			tabindex="-1"
			aria-label="remove"
			onclick={(e) => {
				e.stopPropagation();
				onremove?.();
			}}
			onkeydown={() => {}}
		>
			<Icon name="x" size={13} />
		</span>
	{/if}
</button>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding-inline: var(--sp-3);
		padding-block: 7px;
		border-radius: var(--r-full);
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.85rem;
		font-weight: 600;
		transition: all var(--dur-fast) var(--ease);
	}
	.chip:hover {
		border-color: var(--border-strong);
		color: var(--text);
	}
	.selected {
		background: var(--accent-soft);
		border-color: var(--border-accent);
		color: var(--accent-strong);
	}
	.rm {
		display: inline-flex;
		align-items: center;
		opacity: 0.8;
	}
	.rm:hover {
		opacity: 1;
	}
</style>
