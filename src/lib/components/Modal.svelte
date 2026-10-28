<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'melt/builders';
	import Icon from './Icon.svelte';

	interface Props {
		open?: boolean;
		title?: string;
		width?: string;
		onclose?: () => void;
		children: Snippet;
		footer?: Snippet;
	}
	let {
		open = $bindable(false),
		title,
		width = '520px',
		onclose,
		children,
		footer
	}: Props = $props();

	// Melt owns behaviour: focus trap, scroll lock, Esc, outside-click, a11y.
	const dialog = new Dialog({
		open: () => open,
		onOpenChange: (v) => {
			open = v;
			if (!v) onclose?.();
		}
	});
</script>

<div {...dialog.overlay} class="melt-dialog-overlay"></div>
<dialog {...dialog.content} class="dialog" aria-label={title} style="--w:{width}">
	{#if title}
		<header>
			<h3>{title}</h3>
			<button class="x" aria-label="close" onclick={() => (dialog.open = false)}>
				<Icon name="x" size={18} />
			</button>
		</header>
	{/if}
	<div class="body">{@render children()}</div>
	{#if footer}<footer>{@render footer()}</footer>{/if}
</dialog>

<style>
	.dialog {
		position: fixed;
		inset-block-start: 50%;
		inset-inline-start: 50%;
		translate: -50% -50%;
		z-index: var(--z-modal);
		inline-size: min(100% - var(--sp-5) * 2, var(--w));
		max-inline-size: calc(100% - var(--sp-5) * 2);
		max-block-size: 86vh;
		margin: 0;
		padding: 0;
		background: var(--elevated);
		color: var(--text);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		opacity: 1;
		transform: scale(1);
		transition:
			opacity var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}
	.dialog:not([data-open]) {
		opacity: 0;
		transform: scale(0.96);
	}
	.dialog::backdrop {
		background: transparent;
	}
	@starting-style {
		.dialog[data-open] {
			opacity: 0;
			transform: scale(0.96);
		}
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-4) var(--sp-5);
		border-block-end: 1px solid var(--border);
	}
	header h3 {
		font-size: 1.05rem;
	}
	.x {
		display: grid;
		place-items: center;
		inline-size: 34px;
		block-size: 34px;
		border-radius: var(--r-full);
		background: transparent;
		color: var(--text-muted);
		border: none;
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
	}
	.x:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.x:active {
		transform: scale(0.92);
	}
	.body {
		padding: var(--sp-5);
		overflow-y: auto;
	}
	footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-5);
		border-block-start: 1px solid var(--border);
	}
</style>
