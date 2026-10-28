<script lang="ts">
	import { timecode } from '$lib/util/format';

	interface Props {
		currentTime: number;
		duration: number;
		buffered: number;
		onseek: (seconds: number) => void;
	}
	let { currentTime, duration, buffered, onseek }: Props = $props();

	let bar = $state<HTMLDivElement | null>(null);
	let hovering = $state(false);
	let hoverRatio = $state(0);
	let dragging = $state(false);

	let playedPct = $derived(duration > 0 ? (currentTime / duration) * 100 : 0);
	let bufferedPct = $derived(duration > 0 ? (buffered / duration) * 100 : 0);
	let hoverTime = $derived(hoverRatio * duration);

	function ratioAt(clientX: number): number {
		if (!bar) return 0;
		const r = bar.getBoundingClientRect();
		return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
	}

	function onmove(e: PointerEvent) {
		hoverRatio = ratioAt(e.clientX);
		if (dragging) onseek(hoverRatio * duration);
	}
	function ondown(e: PointerEvent) {
		dragging = true;
		bar?.setPointerCapture(e.pointerId);
		onseek(ratioAt(e.clientX) * duration);
	}
	function onup(e: PointerEvent) {
		dragging = false;
		bar?.releasePointerCapture(e.pointerId);
	}
</script>

<div class="seek" dir="ltr">
	{#if hovering || dragging}
		<div class="preview" style="left:{hoverRatio * 100}%">
			<div class="thumb"><span>{timecode(hoverTime)}</span></div>
			<div class="tip">{timecode(hoverTime)}</div>
		</div>
	{/if}
	<div
		class="rail"
		bind:this={bar}
		role="slider"
		tabindex="0"
		aria-label="seek"
		aria-valuemin={0}
		aria-valuemax={Math.round(duration)}
		aria-valuenow={Math.round(currentTime)}
		onpointerdown={ondown}
		onpointermove={onmove}
		onpointerup={onup}
		onpointerenter={() => (hovering = true)}
		onpointerleave={() => (hovering = false)}
	>
		<div class="buffered" style="width:{bufferedPct}%"></div>
		<div class="played" style="width:{playedPct}%"></div>
		<div class="knob" style="left:{playedPct}%"></div>
	</div>
</div>

<style>
	.seek {
		position: relative;
		inline-size: 100%;
		padding-block: var(--sp-2);
	}
	.rail {
		position: relative;
		block-size: 6px;
		border-radius: var(--r-full);
		background: rgba(255, 255, 255, 0.18);
		cursor: pointer;
		transition: block-size var(--dur-fast) var(--ease);
	}
	.rail:hover {
		block-size: 8px;
	}
	.rail:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
		block-size: 8px;
	}
	.rail:focus-visible .knob {
		opacity: 1;
	}
	.buffered,
	.played {
		position: absolute;
		inset-block: 0;
		left: 0;
		border-radius: var(--r-full);
	}
	.buffered {
		background: rgba(255, 255, 255, 0.28);
	}
	.played {
		background: linear-gradient(90deg, var(--accent-dim), var(--accent));
	}
	.knob {
		position: absolute;
		inset-block-start: 50%;
		inline-size: 14px;
		block-size: 14px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 4px var(--accent-glow);
		transform: translate(-50%, -50%);
		opacity: 0;
		transition: opacity var(--dur-fast) var(--ease);
	}
	.rail:hover .knob,
	.seek:hover .knob {
		opacity: 1;
	}
	.preview {
		position: absolute;
		inset-block-end: 100%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		pointer-events: none;
	}
	.thumb {
		inline-size: 150px;
		block-size: 84px;
		border-radius: var(--r-sm);
		background: linear-gradient(135deg, var(--surface-3), var(--surface-1));
		border: 1px solid var(--border-strong);
		box-shadow: var(--shadow-md);
		display: grid;
		place-items: center;
	}
	.thumb span {
		font-family: var(--font-latin);
		font-size: 0.72rem;
		color: var(--text-dim);
	}
	.tip {
		font-family: var(--font-latin);
		font-size: 0.72rem;
		background: var(--scrim);
		padding-inline: 6px;
		padding-block: 2px;
		border-radius: var(--r-xs);
	}
</style>
