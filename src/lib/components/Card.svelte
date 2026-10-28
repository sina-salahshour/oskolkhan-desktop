<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		href?: string;
		interactive?: boolean;
		padding?: string;
		glow?: boolean;
		class?: string;
		children: Snippet;
	}
	let {
		href,
		interactive = false,
		padding = 'var(--sp-5)',
		glow = false,
		class: cls = '',
		children
	}: Props = $props();
</script>

{#if href}
	<a class="card {cls}" class:interactive class:glow {href} style="--pad:{padding}">
		{@render children()}
	</a>
{:else}
	<div class="card {cls}" class:interactive class:glow style="--pad:{padding}">
		{@render children()}
	</div>
{/if}

<style>
	.card {
		display: block;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: var(--pad);
		color: inherit;
		transition:
			transform var(--dur) var(--ease),
			border-color var(--dur) var(--ease),
			box-shadow var(--dur) var(--ease);
	}
	.interactive {
		cursor: pointer;
	}
	.interactive:hover {
		transform: translateY(-3px);
		border-color: var(--border-strong);
		box-shadow: var(--shadow-md);
	}
	.interactive:active {
		transform: translateY(-1px) scale(0.995);
	}
	.glow {
		box-shadow: var(--shadow-glow);
		border-color: var(--border-accent);
	}
</style>
