<script lang="ts" generics="T extends string | number">
	import Icon, { type IconName } from './Icon.svelte';

	interface Option {
		value: T;
		label?: string;
		icon?: IconName;
	}
	interface Props {
		options: Option[];
		value?: T;
		onchange?: (v: T) => void;
		size?: 'sm' | 'md';
	}
	let { options, value = $bindable(), onchange, size = 'md' }: Props = $props();

	function select(v: T) {
		value = v;
		onchange?.(v);
	}
</script>

<div class="seg {size}" role="tablist">
	{#each options as opt (opt.value)}
		<button
			type="button"
			role="tab"
			aria-selected={value === opt.value}
			class:active={value === opt.value}
			onclick={() => select(opt.value)}
			title={opt.label}
		>
			{#if opt.icon}<Icon name={opt.icon} size={size === 'sm' ? 15 : 17} />{/if}
			{#if opt.label}<span>{opt.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 3px;
		gap: 2px;
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		border: none;
		background: transparent;
		color: var(--text-muted);
		border-radius: var(--r-sm);
		font-weight: 600;
		font-size: 0.86rem;
		transition: all var(--dur-fast) var(--ease);
		white-space: nowrap;
	}
	.md button {
		padding-inline: var(--sp-4);
		block-size: 34px;
	}
	.sm button {
		padding-inline: var(--sp-3);
		block-size: 28px;
		font-size: 0.8rem;
	}
	button:hover {
		color: var(--text);
	}
	button.active {
		background: var(--surface-hover);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
</style>
