<script lang="ts">
	import type { Snippet } from 'svelte';
	type Tone = 'gold' | 'blue' | 'violet' | 'red' | 'neutral' | 'success';
	interface Props {
		tone?: Tone;
		children: Snippet;
	}
	let { tone = 'neutral', children }: Props = $props();
</script>

<span class="badge {tone}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		padding-inline: 7px;
		padding-block: 3px;
		border-radius: var(--r-xs);
		line-height: 1;
		border: 1px solid transparent;
		font-family: var(--font-latin);
		white-space: nowrap;
	}
	.gold {
		background: var(--accent-soft);
		color: var(--accent-strong);
		border-color: var(--border-accent);
	}
	.blue {
		background: rgba(88, 166, 255, 0.15);
		color: #8cc2ff;
		border-color: rgba(88, 166, 255, 0.35);
	}
	.violet {
		background: rgba(167, 139, 250, 0.15);
		color: #c4b2ff;
		border-color: rgba(167, 139, 250, 0.35);
	}
	.red {
		background: var(--danger-soft);
		color: #ff9aa2;
		border-color: color-mix(in srgb, var(--danger) 35%, transparent);
		font-family: var(--font-fa);
	}
	.success {
		background: var(--success-soft);
		color: var(--success);
		border-color: color-mix(in srgb, var(--success) 35%, transparent);
	}
	.neutral {
		background: var(--surface-3);
		color: var(--text-muted);
		border-color: var(--border);
	}
</style>
