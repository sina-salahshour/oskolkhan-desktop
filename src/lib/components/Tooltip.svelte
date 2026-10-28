<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Tooltip as MeltTooltip } from 'melt/builders';

	interface Props {
		content: string;
		placement?: 'top' | 'bottom' | 'left' | 'right';
		openDelay?: number;
		children: Snippet;
	}
	let { content, placement = 'top', openDelay = 350, children }: Props = $props();

	// Melt owns hover/focus timing, a11y (aria-describedby), and positioning.
	const tt = new MeltTooltip({
		openDelay: () => openDelay,
		closeDelay: 0,
		floatingConfig: () => ({ computePosition: { placement }, offset: 8 })
	});
</script>

<span {...tt.trigger} class="tt-trigger">{@render children()}</span>
<div {...tt.content} class="melt-pop tip">
	{content}
	<div {...tt.arrow} class="tip-arrow"></div>
</div>

<style>
	.tt-trigger {
		display: inline-flex;
	}
	.tip {
		padding-inline: var(--sp-3);
		padding-block: 6px;
		font-size: 0.78rem;
		font-weight: 600;
		max-inline-size: 240px;
		border-radius: var(--r-sm);
		pointer-events: none;
	}
	.tip-arrow {
		position: absolute;
		inline-size: 8px;
		block-size: 8px;
		background: var(--elevated);
		border-inline-start: 1px solid var(--border-strong);
		border-block-start: 1px solid var(--border-strong);
	}
</style>
