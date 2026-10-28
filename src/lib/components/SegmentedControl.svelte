<script lang="ts" generics="T extends string | number">
	import { Tabs } from 'melt/builders';
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

	// Melt Tabs keys on strings; map our (possibly numeric) values through it so
	// we inherit roving tabindex + arrow-key navigation + aria roles for free.
	function keyOf(v: T | undefined): string {
		return v === undefined ? '' : String(v);
	}
	function fromKey(k: string): T {
		const match = options.find((o) => String(o.value) === k);
		return (match ? match.value : (k as T)) as T;
	}

	const tabs = new Tabs<string>({
		value: () => keyOf(value) || keyOf(options[0]?.value),
		onValueChange: (k) => {
			const v = fromKey(k);
			value = v;
			onchange?.(v);
		}
	});
</script>

<div {...tabs.triggerList} class="seg {size}">
	{#each options as opt (opt.value)}
		{@const k = String(opt.value)}
		<button
			{...tabs.getTrigger(k)}
			class="seg-btn"
			class:active={tabs.value === k}
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
	.seg-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		border: none;
		background: transparent;
		color: var(--text-muted);
		border-radius: var(--r-sm);
		font-weight: 600;
		font-size: 0.86rem;
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
		white-space: nowrap;
	}
	.md .seg-btn {
		padding-inline: var(--sp-4);
		block-size: 34px;
	}
	.sm .seg-btn {
		padding-inline: var(--sp-3);
		block-size: 28px;
		font-size: 0.8rem;
	}
	.seg-btn:hover {
		color: var(--text);
	}
	.seg-btn:active {
		transform: scale(0.96);
	}
	.seg-btn.active {
		background: var(--surface-hover);
		color: var(--text);
		box-shadow: var(--shadow-sm);
	}
</style>
