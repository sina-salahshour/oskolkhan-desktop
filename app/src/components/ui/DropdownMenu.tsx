/** DropdownMenu: styled Radix DropdownMenu with animated content and icon-aware items. */
import * as React from 'react';
import * as RD from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { Check, Circle } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { overlayMotion, useOpenState } from './_shared';

const OpenContext = React.createContext(false);

export type DropdownMenuProps = RD.DropdownMenuProps;
export function DropdownMenu({ open, defaultOpen, onOpenChange, children, ...rest }: DropdownMenuProps) {
	const [current, handle] = useOpenState(open, defaultOpen, onOpenChange);
	return (
		<OpenContext.Provider value={current}>
			<RD.Root open={current} onOpenChange={handle} {...rest}>
				{children}
			</RD.Root>
		</OpenContext.Provider>
	);
}

export const DropdownMenuTrigger = RD.Trigger;
export const DropdownMenuGroup = RD.Group;
export const DropdownMenuRadioGroup = RD.RadioGroup;

export type DropdownMenuContentProps = Omit<
	React.ComponentPropsWithoutRef<typeof RD.Content>,
	'asChild' | 'forceMount'
>;

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
	function DropdownMenuContent({ className, sideOffset = 6, align = 'start', children, ...rest }, ref) {
		const reduce = useReducedMotion();
		const open = React.useContext(OpenContext);
		return (
			<AnimatePresence>
				{open ? (
					<RD.Portal forceMount>
						<RD.Content asChild forceMount ref={ref} sideOffset={sideOffset} align={align} {...rest}>
							<motion.div
								className={cn(
									'z-50 min-w-[10rem] rounded-lg border border-line bg-surface p-1 text-fg shadow-lg outline-none',
									className,
								)}
								style={{ transformOrigin: 'var(--radix-dropdown-menu-content-transform-origin)' }}
								{...overlayMotion(reduce, 0.95)}
							>
								{children}
							</motion.div>
						</RD.Content>
					</RD.Portal>
				) : null}
			</AnimatePresence>
		);
	},
);

const itemBase =
	'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg outline-none transition-colors ' +
	'data-[highlighted]:bg-surface-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50';

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof RD.Item> {
	leftIcon?: LucideIcon;
	/** Render in danger color. */
	destructive?: boolean;
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(function DropdownMenuItem(
	{ className, leftIcon, destructive = false, children, ...rest },
	ref,
) {
	return (
		<RD.Item
			ref={ref}
			className={cn(itemBase, destructive && 'text-danger data-[highlighted]:bg-danger-soft', className)}
			{...rest}
		>
			{leftIcon ? <Icon icon={leftIcon} size={16} className="text-muted" /> : null}
			{children}
		</RD.Item>
	);
});

export interface DropdownMenuCheckboxItemProps
	extends React.ComponentPropsWithoutRef<typeof RD.CheckboxItem> {
	leftIcon?: LucideIcon;
}

export const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(
	function DropdownMenuCheckboxItem({ className, leftIcon, children, ...rest }, ref) {
		return (
			<RD.CheckboxItem ref={ref} className={cn(itemBase, 'ps-8', className)} {...rest}>
				<span className="absolute start-2 inline-flex h-4 w-4 items-center justify-center">
					<RD.ItemIndicator>
						<Icon icon={Check} size={14} className="text-accent" />
					</RD.ItemIndicator>
				</span>
				{leftIcon ? <Icon icon={leftIcon} size={16} className="text-muted" /> : null}
				{children}
			</RD.CheckboxItem>
		);
	},
);

export interface DropdownMenuRadioItemProps extends React.ComponentPropsWithoutRef<typeof RD.RadioItem> {
	leftIcon?: LucideIcon;
}

export const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, DropdownMenuRadioItemProps>(
	function DropdownMenuRadioItem({ className, leftIcon, children, ...rest }, ref) {
		return (
			<RD.RadioItem ref={ref} className={cn(itemBase, 'ps-8', className)} {...rest}>
				<span className="absolute start-2 inline-flex h-4 w-4 items-center justify-center">
					<RD.ItemIndicator>
						<Icon icon={Circle} size={8} className="fill-accent text-accent" />
					</RD.ItemIndicator>
				</span>
				{leftIcon ? <Icon icon={leftIcon} size={16} className="text-muted" /> : null}
				{children}
			</RD.RadioItem>
		);
	},
);

export type DropdownMenuLabelProps = React.ComponentPropsWithoutRef<typeof RD.Label>;
export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
	function DropdownMenuLabel({ className, ...rest }, ref) {
		return (
			<RD.Label
				ref={ref}
				className={cn('px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle', className)}
				{...rest}
			/>
		);
	},
);

export type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<typeof RD.Separator>;
export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(
	function DropdownMenuSeparator({ className, ...rest }, ref) {
		return <RD.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-line', className)} {...rest} />;
	},
);
