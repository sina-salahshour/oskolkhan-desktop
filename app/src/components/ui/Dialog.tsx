/** Dialog: Radix Dialog with animated scrim + content (AnimatePresence tied to open state). */
import * as React from 'react';
import * as RD from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { fadeMotion, focusRing, overlayMotion, useOpenState } from './_shared';

const OpenContext = React.createContext(false);

export type DialogProps = RD.DialogProps;

export function Dialog({ open, defaultOpen, onOpenChange, children, ...rest }: DialogProps) {
	const [current, handle] = useOpenState(open, defaultOpen, onOpenChange);
	return (
		<OpenContext.Provider value={current}>
			<RD.Root open={current} onOpenChange={handle} {...rest}>
				{children}
			</RD.Root>
		</OpenContext.Provider>
	);
}

export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export type DialogSize = 'sm' | 'md' | 'lg';
const sizes: Record<DialogSize, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export interface DialogContentProps
	extends Omit<React.ComponentPropsWithoutRef<typeof RD.Content>, 'asChild' | 'forceMount'> {
	/** Default 'md'. */
	size?: DialogSize;
	/** Hide the top-end close button. */
	hideClose?: boolean;
	/** Accessible label for the close button (default "Close"). */
	closeLabel?: string;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent(
	{ size = 'md', hideClose = false, closeLabel = 'Close', className, children, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	const open = React.useContext(OpenContext);
	return (
		<AnimatePresence>
			{open ? (
				<RD.Portal forceMount>
					<RD.Overlay asChild forceMount>
						<motion.div className="fixed inset-0 z-50 bg-overlay/70 backdrop-blur-sm" {...fadeMotion(reduce)} />
					</RD.Overlay>
					<RD.Content asChild forceMount ref={ref} {...rest}>
						<motion.div
							className={cn(
								'fixed inset-0 z-50 m-auto h-fit max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto',
								'rounded-xl border border-line bg-surface p-6 text-fg shadow-lg outline-none',
								sizes[size],
								className,
							)}
							{...overlayMotion(reduce, 0.95)}
						>
							{children}
							{hideClose ? null : (
								<RD.Close
									aria-label={closeLabel}
									className={cn(
										'absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg',
										focusRing,
									)}
								>
									<Icon icon={X} size={16} />
								</RD.Close>
							)}
						</motion.div>
					</RD.Content>
				</RD.Portal>
			) : null}
		</AnimatePresence>
	);
});

export type DialogHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export function DialogHeader({ className, ...rest }: DialogHeaderProps) {
	return <div className={cn('mb-4 flex flex-col gap-1.5 pe-8', className)} {...rest} />;
}

export type DialogFooterProps = React.HTMLAttributes<HTMLDivElement>;
export function DialogFooter({ className, ...rest }: DialogFooterProps) {
	return <div className={cn('mt-6 flex flex-wrap items-center justify-end gap-2', className)} {...rest} />;
}

export type DialogTitleProps = React.ComponentPropsWithoutRef<typeof RD.Title>;
export const DialogTitle = React.forwardRef<HTMLHeadingElement, DialogTitleProps>(function DialogTitle(
	{ className, ...rest },
	ref,
) {
	return <RD.Title ref={ref} className={cn('text-lg font-semibold leading-tight text-fg', className)} {...rest} />;
});

export type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof RD.Description>;
export const DialogDescription = React.forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
	function DialogDescription({ className, ...rest }, ref) {
		return <RD.Description ref={ref} className={cn('text-sm text-muted', className)} {...rest} />;
	},
);
