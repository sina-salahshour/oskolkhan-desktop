/** Tooltip: Radix Tooltip with animated content, plus TooltipTip convenience wrapper. */
import * as React from 'react';
import * as RT from '@radix-ui/react-tooltip';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';
import { overlayMotion, useOpenState } from './_shared';

const OpenContext = React.createContext(false);

export type TooltipProviderProps = RT.TooltipProviderProps;
export function TooltipProvider({ delayDuration = 250, skipDelayDuration = 300, ...rest }: TooltipProviderProps) {
	return <RT.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...rest} />;
}

export type TooltipProps = RT.TooltipProps;
export function Tooltip({ open, defaultOpen, onOpenChange, children, ...rest }: TooltipProps) {
	const [current, handle] = useOpenState(open, defaultOpen, onOpenChange);
	return (
		<OpenContext.Provider value={current}>
			<RT.Root open={current} onOpenChange={handle} {...rest}>
				{children}
			</RT.Root>
		</OpenContext.Provider>
	);
}

export const TooltipTrigger = RT.Trigger;

export type TooltipContentProps = Omit<React.ComponentPropsWithoutRef<typeof RT.Content>, 'asChild' | 'forceMount'>;

export const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(function TooltipContent(
	{ className, sideOffset = 6, children, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	const open = React.useContext(OpenContext);
	return (
		<AnimatePresence>
			{open ? (
				<RT.Portal forceMount>
					<RT.Content asChild forceMount ref={ref} sideOffset={sideOffset} {...rest}>
						<motion.div
							className={cn(
								'z-50 max-w-xs rounded-md border border-line bg-surface-2 px-2 py-1 text-xs text-fg shadow-lg',
								className,
							)}
							style={{ transformOrigin: 'var(--radix-tooltip-content-transform-origin)' }}
							{...overlayMotion(reduce, 0.92)}
						>
							{children}
						</motion.div>
					</RT.Content>
				</RT.Portal>
			) : null}
		</AnimatePresence>
	);
});

export interface TooltipTipProps {
	label: React.ReactNode;
	side?: 'top' | 'right' | 'bottom' | 'left';
	align?: 'start' | 'center' | 'end';
	/** ms; defaults to provider delay. */
	delayDuration?: number;
	/** Single element trigger (rendered with asChild). */
	children: React.ReactElement;
	className?: string;
}

export function TooltipTip({ label, side = 'top', align = 'center', delayDuration, children, className }: TooltipTipProps) {
	return (
		<Tooltip delayDuration={delayDuration}>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent side={side} align={align} className={className}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}
