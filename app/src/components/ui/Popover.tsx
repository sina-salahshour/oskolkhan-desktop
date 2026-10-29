/** Popover: Radix Popover with animated surface content. */
import * as React from 'react';
import * as RP from '@radix-ui/react-popover';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';
import { overlayMotion, useOpenState } from './_shared';

const OpenContext = React.createContext(false);

export type PopoverProps = RP.PopoverProps;

export function Popover({ open, defaultOpen, onOpenChange, children, ...rest }: PopoverProps) {
	const [current, handle] = useOpenState(open, defaultOpen, onOpenChange);
	return (
		<OpenContext.Provider value={current}>
			<RP.Root open={current} onOpenChange={handle} {...rest}>
				{children}
			</RP.Root>
		</OpenContext.Provider>
	);
}

export const PopoverTrigger = RP.Trigger;
export const PopoverAnchor = RP.Anchor;
export const PopoverClose = RP.Close;

export type PopoverContentProps = Omit<React.ComponentPropsWithoutRef<typeof RP.Content>, 'asChild' | 'forceMount'>;

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(function PopoverContent(
	{ className, sideOffset = 8, align = 'center', children, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	const open = React.useContext(OpenContext);
	return (
		<AnimatePresence>
			{open ? (
				<RP.Portal forceMount>
					<RP.Content asChild forceMount ref={ref} sideOffset={sideOffset} align={align} {...rest}>
						<motion.div
							className={cn(
								'z-50 w-72 rounded-lg border border-line bg-surface p-4 text-fg shadow-lg outline-none',
								className,
							)}
							style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
							{...overlayMotion(reduce, 0.95)}
						>
							{children}
						</motion.div>
					</RP.Content>
				</RP.Portal>
			) : null}
		</AnimatePresence>
	);
});
