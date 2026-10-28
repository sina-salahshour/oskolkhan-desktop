<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
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

	function close() {
		open = false;
		onclose?.();
	}
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="backdrop" transition:fade={{ duration: 150 }}>
		<button class="scrim" aria-label="close" onclick={close}></button>
		<div
			class="dialog"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			style="max-inline-size:{width}"
			transition:scale={{ duration: 200, start: 0.96 }}
		>
			{#if title}
				<header>
					<h3>{title}</h3>
					<button class="x" aria-label="close" onclick={close}><Icon name="x" size={18} /></button>
				</header>
			{/if}
			<div class="body">{@render children()}</div>
			{#if footer}<footer>{@render footer()}</footer>{/if}
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: grid;
		place-items: center;
		padding: var(--sp-4);
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--scrim);
		backdrop-filter: blur(6px);
		border: none;
		cursor: default;
	}
	.dialog {
		position: relative;
		inline-size: 100%;
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-lg);
		max-block-size: 86vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
	}
	.x:hover {
		background: var(--surface-2);
		color: var(--text);
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
