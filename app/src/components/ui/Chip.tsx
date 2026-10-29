/** Chip: selectable/toggle filter chip with optional remove (X) button. */
import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { X } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { focusRing, type MotionSafe } from './_shared';

export interface ChipProps extends MotionSafe<React.ButtonHTMLAttributes<HTMLButtonElement>> {
	selected?: boolean;
	onRemove?: () => void;
	leftIcon?: LucideIcon;
	/** Accessible label for the remove button (default "Remove"). */
	removeLabel?: string;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
	{
		selected = false,
		onRemove,
		leftIcon,
		removeLabel = 'Remove',
		className,
		children,
		disabled,
		type = 'button',
		...rest
	},
	ref,
) {
	const reduce = useReducedMotion();
	const animate = !disabled && !reduce;
	return (
		<motion.div
			className={cn(
				'inline-flex h-8 items-center rounded-full border text-sm transition-colors duration-150',
				selected
					? 'border-accent bg-accent-soft text-accent'
					: 'border-line bg-transparent text-muted hover:bg-surface-2 hover:text-fg',
				disabled && 'pointer-events-none opacity-50',
				className,
			)}
			whileTap={animate ? { scale: 0.97 } : undefined}
		>
			<button
				ref={ref}
				type={type}
				disabled={disabled}
				aria-pressed={selected}
				className={cn(
					'inline-flex h-full items-center gap-1.5 rounded-full ps-3 font-medium',
					onRemove ? 'pe-1.5' : 'pe-3',
					focusRing,
				)}
				{...rest}
			>
				{leftIcon ? <Icon icon={leftIcon} size={14} /> : null}
				{children}
			</button>
			{onRemove ? (
				<button
					type="button"
					aria-label={removeLabel}
					disabled={disabled}
					onClick={onRemove}
					className={cn('me-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-line', focusRing)}
				>
					<Icon icon={X} size={12} />
				</button>
			) : null}
		</motion.div>
	);
});
