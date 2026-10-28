<script lang="ts">
	interface Props {
		size?: number;
		label?: string;
	}
	let { size = 28, label }: Props = $props();
</script>

<div class="wrap" role="status" aria-live="polite">
	<span class="spinner" style="--s:{size}px" aria-hidden="true"></span>
	{#if label}<span class="lbl">{label}</span>{/if}
</div>

<style>
	.wrap {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-3);
		color: var(--text-muted);
	}
	.spinner {
		inline-size: var(--s);
		block-size: var(--s);
		border-radius: 50%;
		border: 2.5px solid var(--surface-3);
		border-top-color: var(--accent);
		animation: sp 0.8s linear infinite;
	}
	.lbl {
		font-size: 0.85rem;
	}
	@keyframes sp {
		to {
			transform: rotate(360deg);
		}
	}
</style>
