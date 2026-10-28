<script lang="ts">
	import { digits } from '$lib/util/format';

	interface Props {
		min?: number;
		max?: number;
		step?: number;
		from?: number;
		to?: number;
		label?: string;
		suffix?: string;
		onchange?: () => void;
	}
	let {
		min = 0,
		max = 100,
		step = 1,
		from = $bindable(min),
		to = $bindable(max),
		label,
		suffix = '',
		onchange
	}: Props = $props();

	let pctFrom = $derived(((from - min) / (max - min)) * 100);
	let pctTo = $derived(((to - min) / (max - min)) * 100);

	function onFrom(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		from = Math.min(v, to);
		onchange?.();
	}
	function onTo(e: Event) {
		const v = Number((e.target as HTMLInputElement).value);
		to = Math.max(v, from);
		onchange?.();
	}
</script>

<div class="range">
	{#if label}
		<div class="head">
			<span class="lbl">{label}</span>
			<span class="val latin">{digits(from)}{suffix} – {digits(to)}{suffix}</span>
		</div>
	{/if}
	<div class="track">
		<div class="rail"></div>
		<div class="fill" style="inset-inline-start:{pctFrom}%;inline-size:{pctTo - pctFrom}%"></div>
		<input
			class="thumb"
			type="range"
			{min}
			{max}
			{step}
			value={from}
			oninput={onFrom}
			aria-label={`${label ?? ''} min`}
		/>
		<input
			class="thumb"
			type="range"
			{min}
			{max}
			{step}
			value={to}
			oninput={onTo}
			aria-label={`${label ?? ''} max`}
		/>
	</div>
</div>

<style>
	.range {
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
	.track {
		position: relative;
		block-size: 22px;
		display: flex;
		align-items: center;
	}
	.rail {
		position: absolute;
		inset-inline: 0;
		block-size: 5px;
		border-radius: var(--r-full);
		background: var(--surface-3);
	}
	.fill {
		position: absolute;
		block-size: 5px;
		border-radius: var(--r-full);
		background: linear-gradient(90deg, var(--accent-dim), var(--accent));
	}
	input.thumb {
		position: absolute;
		inset-inline: 0;
		inline-size: 100%;
		margin: 0;
		background: none;
		pointer-events: none;
		-webkit-appearance: none;
		appearance: none;
	}
	input.thumb::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		pointer-events: auto;
		inline-size: 18px;
		block-size: 18px;
		border-radius: 50%;
		background: var(--text);
		border: 3px solid var(--accent);
		box-shadow: var(--shadow-sm);
		cursor: grab;
	}
	input.thumb::-moz-range-thumb {
		pointer-events: auto;
		inline-size: 18px;
		block-size: 18px;
		border-radius: 50%;
		background: var(--text);
		border: 3px solid var(--accent);
		cursor: grab;
	}
	input.thumb::-webkit-slider-runnable-track {
		background: transparent;
	}
	input.thumb::-moz-range-track {
		background: transparent;
	}
</style>
