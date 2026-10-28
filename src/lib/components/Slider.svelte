<script lang="ts">
	import { Slider as MeltSlider } from 'melt/builders';

	interface Props {
		min?: number;
		max?: number;
		step?: number;
		value?: number;
		label?: string;
		valueText?: string;
		ariaLabel?: string;
		onchange?: (v: number) => void;
	}
	let {
		min = 0,
		max = 100,
		step = 1,
		value = $bindable(0),
		label,
		valueText,
		ariaLabel,
		onchange
	}: Props = $props();

	// Melt owns drag, keyboard (arrows/home/end), and aria-valuenow.
	const slider = new MeltSlider({
		min: () => min,
		max: () => max,
		step: () => step,
		value: () => value,
		onValueChange: (v) => {
			value = v;
			onchange?.(v);
		}
	});
</script>

<div class="slider">
	{#if label || valueText}
		<div class="head">
			{#if label}<span class="lbl">{label}</span>{/if}
			{#if valueText}<span class="val latin">{valueText}</span>{/if}
		</div>
	{/if}
	<div {...slider.root} class="rail" aria-label={ariaLabel ?? label}>
		<div class="fill"></div>
		<div {...slider.thumb} class="thumb"></div>
	</div>
</div>

<style>
	.slider {
		inline-size: 100%;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-block-end: var(--sp-3);
	}
	.lbl {
		font-size: 0.88rem;
		font-weight: 600;
	}
	.val {
		font-size: 0.8rem;
		color: var(--accent);
		font-weight: 700;
	}
	.rail {
		position: relative;
		block-size: 20px;
		display: flex;
		align-items: center;
		cursor: pointer;
		touch-action: none;
	}
	.rail::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		block-size: 5px;
		border-radius: var(--r-full);
		background: var(--surface-3);
	}
	.fill {
		position: absolute;
		inset-inline-start: 0;
		block-size: 5px;
		inline-size: var(--percentage);
		border-radius: var(--r-full);
		background: linear-gradient(90deg, var(--accent-dim), var(--accent));
	}
	.thumb {
		position: absolute;
		inset-inline-start: var(--percentage);
		translate: -50% 0;
		inline-size: 16px;
		block-size: 16px;
		border-radius: 50%;
		background: var(--text);
		border: 3px solid var(--accent);
		box-shadow: var(--shadow-sm);
		transition:
			transform var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}
	.rail:hover .thumb,
	.thumb:focus-visible {
		transform: scale(1.15);
		box-shadow: 0 0 0 5px var(--accent-soft);
	}
	.rail[data-dragging] .thumb {
		transform: scale(1.2);
		cursor: grabbing;
	}
	:root[dir='rtl'] .thumb {
		translate: 50% 0;
	}
	:root[dir='rtl'] .fill {
		inset-inline-start: auto;
		inset-inline-end: 0;
	}
</style>
