/** Button: solid/outline/ghost/subtle/danger variants, loading state, asChild via Radix Slot. */
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { Loader2 } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { focusRing, type MotionSafe } from './_shared';

export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'subtle' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends MotionSafe<React.ButtonHTMLAttributes<HTMLButtonElement>> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	fullWidth?: boolean;
	leftIcon?: LucideIcon;
	rightIcon?: LucideIcon;
	asChild?: boolean;
}

const variants: Record<ButtonVariant, string> = {
	solid: 'bg-accent text-accent-fg hover:bg-accent/90',
	outline: 'border border-line-strong bg-transparent text-fg hover:bg-surface-2',
	ghost: 'bg-transparent text-fg hover:bg-surface-2',
	subtle: 'bg-surface-2 text-fg hover:bg-line',
	danger: 'bg-danger text-danger-fg hover:bg-danger/90',
};

const sizes: Record<ButtonSize, string> = {
	sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
	md: 'h-10 px-4 text-sm gap-2 rounded-md',
	lg: 'h-12 px-6 text-base gap-2.5 rounded-lg',
};

const iconSizes: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
	{
		variant = 'solid',
		size = 'md',
		loading = false,
		fullWidth = false,
		leftIcon,
		rightIcon,
		asChild = false,
		className,
		children,
		disabled,
		type = 'button',
		...rest
	},
	ref,
) {
	const reduce = useReducedMotion();
	const isDisabled = Boolean(disabled) || loading;
	const classes = cn(
		'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors duration-150',
		'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
		focusRing,
		variants[variant],
		sizes[size],
		fullWidth && 'w-full',
		className,
	);

	if (asChild) {
		return (
			<Slot ref={ref as React.Ref<HTMLElement>} className={classes} {...rest}>
				{children}
			</Slot>
		);
	}

	const animate = !isDisabled && !reduce;
	const iconSize = iconSizes[size];
	return (
		<motion.button
			ref={ref}
			type={type}
			disabled={isDisabled}
			aria-busy={loading || undefined}
			className={classes}
			whileHover={animate ? { scale: 1.02 } : undefined}
			whileTap={animate ? { scale: 0.97 } : undefined}
			{...rest}
		>
			{loading ? (
				<Icon icon={Loader2} size={iconSize} className="animate-spin" />
			) : leftIcon ? (
				<Icon icon={leftIcon} size={iconSize} />
			) : null}
			{children}
			{rightIcon && !loading ? <Icon icon={rightIcon} size={iconSize} /> : null}
		</motion.button>
	);
});
