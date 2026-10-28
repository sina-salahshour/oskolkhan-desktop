<script lang="ts">
	import { ratingMeta } from '$lib/util/enums';
	import { digits } from '$lib/util/format';
	import type { Rating } from '$lib/api';

	interface Props {
		rating: Rating;
	}
	let { rating }: Props = $props();
	let meta = $derived(ratingMeta(rating.type));
	let value = $derived(digits(rating.r1));
</script>

<div class="rc" title={meta.label} style="--c:{meta.accent}">
	<span class="dot"></span>
	<span class="val">{value}</span>
	<span class="lbl">{meta.label}</span>
</div>

<style>
	.rc {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		padding-inline: var(--sp-3);
		padding-block: 6px;
		border-radius: var(--r-sm);
		background: var(--surface-2);
		border: 1px solid var(--border);
		transition:
			transform var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			background var(--dur-fast) var(--ease);
	}
	.rc:hover {
		transform: translateY(-2px);
		border-color: var(--border-strong);
		background: var(--surface-3);
	}
	.rc:hover .dot {
		box-shadow: 0 0 16px color-mix(in srgb, var(--c) 90%, transparent);
	}
	.dot {
		inline-size: 8px;
		block-size: 8px;
		border-radius: 50%;
		background: var(--c);
		box-shadow: 0 0 10px color-mix(in srgb, var(--c) 60%, transparent);
		transition: box-shadow var(--dur) var(--ease);
	}
	.val {
		font-family: var(--font-latin);
		font-weight: 800;
		font-size: 0.92rem;
	}
	.lbl {
		font-size: 0.72rem;
		color: var(--text-muted);
		font-family: var(--font-latin);
	}
</style>
