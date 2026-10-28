<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';
	import Tooltip from './Tooltip.svelte';

	type Variant = 'ghost' | 'surface' | 'accent';
	type Size = 'sm' | 'md' | 'lg';

	interface Props {
		icon: IconName;
		label: string;
		variant?: Variant;
		size?: Size;
		active?: boolean;
		/** true when this button toggles state — emits aria-pressed */
		toggle?: boolean;
		disabled?: boolean;
		tip?: boolean;
		href?: string;
		onclick?: (e: MouseEvent) => void;
	}
	let {
		icon,
		label,
		variant = 'ghost',
		size = 'md',
		active = false,
		toggle = false,
		disabled = false,
		tip = true,
		href,
		onclick
	}: Props = $props();

	let iconSize = $derived(size === 'lg' ? 22 : size === 'sm' ? 16 : 19);
</script>

{#snippet btn()}
	{#if href}
		<a class="ib {variant} {size}" class:active {href} aria-label={label}>
			<Icon name={icon} size={iconSize} />
		</a>
	{:else}
		<button
			class="ib {variant} {size}"
			class:active
			{disabled}
			aria-label={label}
			aria-pressed={toggle ? active : undefined}
			{onclick}
		>
			<Icon name={icon} size={iconSize} />
		</button>
	{/if}
{/snippet}

{#if tip && !disabled}
	<Tooltip content={label}>{@render btn()}</Tooltip>
{:else}
	{@render btn()}
{/if}

<style>
	.ib {
		display: inline-grid;
		place-items: center;
		border: 1px solid transparent;
		border-radius: var(--r-md);
		background: transparent;
		color: var(--text-muted);
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
	}
	.sm {
		inline-size: 32px;
		block-size: 32px;
	}
	.md {
		inline-size: 40px;
		block-size: 40px;
	}
	.lg {
		inline-size: 46px;
		block-size: 46px;
	}
	.ib:hover {
		color: var(--text);
		transform: translateY(-1px);
	}
	.ib:active {
		transform: scale(0.92);
	}
	.ib:focus-visible {
		outline: 2px solid var(--accent-ring);
		outline-offset: 2px;
	}
	.ib:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		transform: none;
	}
	.surface {
		background: var(--surface-2);
		border-color: var(--border);
	}
	.surface:hover {
		background: var(--surface-hover);
		border-color: var(--border-strong);
	}
	.accent {
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 4px 14px var(--accent-glow);
	}
	.accent:hover {
		color: var(--on-accent);
		filter: brightness(1.06);
	}
	.ib.active {
		color: var(--accent);
		border-color: var(--border-accent);
		background: var(--accent-soft);
	}
</style>
