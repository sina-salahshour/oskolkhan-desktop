/** IconButton: icon-only button; `label` is required (aria-label + title). */
import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { focusRing, type MotionSafe } from './_shared';

export type IconButtonVariant = 'solid' | 'ghost' | 'outline' | 'subtle';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps
	extends MotionSafe<Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>> {
	icon: LucideIcon;
	label: string;
	variant?: IconButtonVariant;
	size?: IconButtonSize;
	/** Use a fully round shape instead of rounded-md. */
	round?: boolean;
}

const variants: Record<IconButtonVariant, string> = {
	solid: 'bg-accent text-accent-fg hover:bg-accent/90',
	ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-fg',
	outline: 'border border-line-strong bg-transparent text-fg hover:bg-surface-2',
	subtle: 'bg-surface-2 text-fg hover:bg-line',
};

const sizes: Record<IconButtonSize, { box: string; icon: number }> = {
	sm: { box: 'h-8 w-8', icon: 16 },
	md: { box: 'h-10 w-10', icon: 20 },
	lg: { box: 'h-12 w-12', icon: 24 },
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
	{ icon, label, variant = 'ghost', size = 'md', round = false, className, disabled, type = 'button', ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	const animate = !disabled && !reduce;
	return (
		<motion.button
			ref={ref}
			type={type}
			disabled={disabled}
			aria-label={label}
			title={label}
			className={cn(
				'inline-flex shrink-0 items-center justify-center transition-colors duration-150',
				'disabled:pointer-events-none disabled:opacity-50',
				focusRing,
				round ? 'rounded-full' : 'rounded-md',
				variants[variant],
				sizes[size].box,
				className,
			)}
			whileHover={animate ? { scale: 1.06 } : undefined}
			whileTap={animate ? { scale: 0.94 } : undefined}
			{...rest}
		>
			<Icon icon={icon} size={sizes[size].icon} />
		</motion.button>
	);
});
