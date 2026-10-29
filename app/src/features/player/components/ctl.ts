/** Shared class strings for the on-video (always dark) control buttons and menu rows. */
export const ctlBtn =
	'inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm text-white ' +
	'transition-colors duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
	'focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 data-[state=open]:bg-white/15';

export const menuRow =
	'flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-start text-sm text-fg ' +
	'transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent';

export const menuRowOn = 'text-accent';
export const menuRowGhost = 'text-muted';
