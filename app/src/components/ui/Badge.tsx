/** Badge and Pill: small status / quality labels (4K, HDR, ...). */
import * as React from 'react';
import { cn } from '../../lib/util/cn';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
	size?: BadgeSize;
}

const variants: Record<BadgeVariant, string> = {
	neutral: 'bg-surface-2 text-muted border-transparent',
	accent: 'bg-accent-soft text-accent border-transparent',
	success: 'bg-success-soft text-success border-transparent',
	danger: 'bg-danger-soft text-danger border-transparent',
	warning: 'bg-warning-soft text-warning border-transparent',
	outline: 'bg-transparent text-muted border-line',
};

const sizes: Record<BadgeSize, string> = {
	sm: 'h-5 px-1.5 text-[10px] gap-1',
	md: 'h-6 px-2 text-xs gap-1.5',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
	{ variant = 'neutral', size = 'md', className, ...rest },
	ref,
) {
	return (
		<span
			ref={ref}
			className={cn(
				'inline-flex items-center whitespace-nowrap rounded-md border font-semibold uppercase tracking-wide',
				variants[variant],
				sizes[size],
				className,
			)}
			{...rest}
		/>
	);
});

export type PillProps = BadgeProps;
export const Pill = React.forwardRef<HTMLSpanElement, PillProps>(function Pill({ className, ...rest }, ref) {
	return <Badge ref={ref} className={cn('rounded-full', className)} {...rest} />;
});
