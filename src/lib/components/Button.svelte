<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
	type Size = 'sm' | 'md' | 'lg' | 'icon';

	interface Props {
		variant?: Variant;
		size?: Size;
		icon?: IconName;
		iconEnd?: IconName;
		disabled?: boolean;
		loading?: boolean;
		type?: 'button' | 'submit';
		href?: string;
		title?: string;
		block?: boolean;
		active?: boolean;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
	}

	let {
		variant = 'secondary',
		size = 'md',
		icon,
		iconEnd,
		disabled = false,
		loading = false,
		type = 'button',
		href,
		title,
		block = false,
		active = false,
		onclick,
		children
	}: Props = $props();

	let iconSize = $derived(size === 'lg' ? 20 : size === 'sm' ? 16 : 18);
</script>

{#snippet inner()}
	{#if loading}
		<span class="spin" aria-hidden="true"></span>
	{:else if icon}
		<Icon name={icon} size={iconSize} />
	{/if}
	{#if children}<span class="label">{@render children()}</span>{/if}
	{#if iconEnd}<Icon name={iconEnd} size={iconSize} />{/if}
{/snippet}

{#if href}
	<a class="btn {variant} {size}" class:block class:active {href} {title} aria-disabled={disabled}>
		{@render inner()}
	</a>
{:else}
	<button
		class="btn {variant} {size}"
		class:block
		class:active
		class:loading
		{type}
		{title}
		disabled={disabled || loading}
		{onclick}
	>
		{@render inner()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		border: 1px solid transparent;
		border-radius: var(--r-md);
		font-weight: 600;
		font-size: 0.92rem;
		line-height: 1;
		white-space: nowrap;
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease),
			box-shadow var(--dur) var(--ease);
		user-select: none;
	}
	.btn:active:not(:disabled) {
		transform: translateY(1px) scale(0.99);
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.block {
		width: 100%;
	}

	.md {
		padding-inline: var(--sp-4);
		block-size: 40px;
	}
	.sm {
		padding-inline: var(--sp-3);
		block-size: 32px;
		font-size: 0.84rem;
	}
	.lg {
		padding-inline: var(--sp-5);
		block-size: 48px;
		font-size: 1rem;
	}
	.icon {
		inline-size: 40px;
		block-size: 40px;
		padding: 0;
	}

	.primary {
		background: linear-gradient(135deg, var(--accent-strong), var(--accent));
		color: var(--on-accent);
		box-shadow: 0 6px 18px var(--accent-glow);
	}
	.primary:hover:not(:disabled) {
		filter: brightness(1.06);
		box-shadow: 0 8px 26px var(--accent-glow);
	}

	.secondary {
		background: var(--surface-2);
		border-color: var(--border);
		color: var(--text);
	}
	.secondary:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--border-strong);
	}

	.outline {
		background: transparent;
		border-color: var(--border-strong);
		color: var(--text);
	}
	.outline:hover:not(:disabled) {
		border-color: var(--accent);
		color: var(--accent);
	}

	.ghost {
		background: transparent;
		color: var(--text-muted);
	}
	.ghost:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}

	.danger {
		background: var(--danger-soft);
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 40%, transparent);
	}
	.danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--danger) 24%, transparent);
	}

	.active {
		border-color: var(--accent);
		color: var(--accent);
	}

	.label {
		display: inline-flex;
	}

	.spin {
		inline-size: 16px;
		block-size: 16px;
		border-radius: 50%;
		border: 2px solid currentColor;
		border-top-color: transparent;
		animation: btn-spin 0.7s linear infinite;
	}
	@keyframes btn-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
