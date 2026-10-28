<script lang="ts">
	import { Progress as MeltProgress } from 'melt/builders';

	type Tone = 'accent' | 'coin' | 'xp' | 'success';
	interface Props {
		value: number;
		max?: number;
		tone?: Tone;
		height?: string;
		glow?: boolean;
		class?: string;
	}
	let {
		value,
		max = 100,
		tone = 'accent',
		height = '8px',
		glow = false,
		class: cls = ''
	}: Props = $props();

	// Melt owns the progressbar role + aria values; we animate the fill.
	const progress = new MeltProgress({ value: () => value, max: () => max });

	const FILL: Record<Tone, string> = {
		accent: 'linear-gradient(90deg, var(--accent-dim), var(--accent))',
		coin: 'linear-gradient(90deg, var(--accent-dim), var(--coin))',
		xp: 'linear-gradient(90deg, #3d7fd1, var(--xp))',
		success: 'linear-gradient(90deg, #2f9f6a, var(--success))'
	};
</script>

<div {...progress.root} class="track {cls}" style="--h:{height}">
	<div {...progress.progress} class="fill" class:glow style="background:{FILL[tone]}"></div>
</div>

<style>
	.track {
		inline-size: 100%;
		block-size: var(--h);
		border-radius: var(--r-full);
		background: var(--surface-3);
		overflow: hidden;
		position: relative;
	}
	.fill {
		position: absolute;
		inset: 0;
		border-radius: var(--r-full);
		/* Melt provides --progress (0 at full, 100 at empty): slide the bar in. */
		transform: translateX(calc(var(--progress, 100) * -1%));
		transition: transform var(--dur-slow) var(--ease);
	}
	:root[dir='rtl'] .fill {
		transform: translateX(calc(var(--progress, 100) * 1%));
	}
	.fill.glow {
		box-shadow: 0 0 12px var(--accent-glow);
	}
</style>
