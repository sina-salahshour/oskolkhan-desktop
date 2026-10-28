<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Popover } from 'melt/builders';

	type Placement = 'top' | 'bottom' | 'left' | 'right';
	type Align = 'start' | 'center' | 'end';

	interface Props {
		placement?: Placement;
		align?: Align;
		sameWidth?: boolean;
		open?: boolean;
		trigger: Snippet<[Record<string, unknown>, boolean]>;
		children: Snippet<[() => void]>;
	}
	let {
		placement = 'bottom',
		align = 'end',
		sameWidth = false,
		open = $bindable(false),
		trigger,
		children
	}: Props = $props();

	// Melt owns open/close, outside-click, Esc, focus management, positioning.
	const pop = new Popover({
		open: () => open,
		onOpenChange: (v) => (open = v),
		sameWidth: () => sameWidth,
		floatingConfig: () => ({
			computePosition: { placement: align === 'center' ? placement : `${placement}-${align}` },
			offset: 8
		})
	});
	const close = () => (pop.open = false);
</script>

{@render trigger(pop.trigger, pop.open)}
<div {...pop.content} class="melt-pop menu">
	{@render children(close)}
</div>

<style>
	.menu {
		min-inline-size: 200px;
		padding: var(--sp-2);
	}
</style>
