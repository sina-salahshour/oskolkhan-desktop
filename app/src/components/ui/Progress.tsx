/** Progress (linear) and CircularProgress (SVG ring); omit `value` for indeterminate. */
import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';

export type ProgressSize = 'sm' | 'md';

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
	/** 0-100. Omit for indeterminate. */
	value?: number;
	size?: ProgressSize;
}

const heights: Record<ProgressSize, string> = { sm: 'h-1', md: 'h-2' };
const clamp = (n: number) => Math.min(100, Math.max(0, n));

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress(
	{ value, size = 'md', className, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	const determinate = typeof value === 'number';
	const pct = determinate ? clamp(value) : 0;
	return (
		<div
			ref={ref}
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={determinate ? Math.round(pct) : undefined}
			className={cn('relative w-full overflow-hidden rounded-full bg-surface-2', heights[size], className)}
			{...rest}
		>
			{determinate ? (
				<motion.div
					className="h-full rounded-full bg-accent"
					initial={false}
					animate={{ width: `${pct}%` }}
					transition={reduce ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
				/>
			) : reduce ? (
				<div className="h-full w-1/3 rounded-full bg-accent opacity-70" />
			) : (
				<motion.div
					className="absolute inset-y-0 start-0 w-2/5 rounded-full bg-accent"
					animate={{ x: ['-100%', '250%'] }}
					transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
				/>
			)}
		</div>
	);
});

export interface CircularProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
	/** 0-100. Omit for indeterminate spin. */
	value?: number;
	/** Diameter in px (default 40). */
	size?: number;
	/** Ring thickness in px (default 4). */
	thickness?: number;
}

export function CircularProgress({ value, size = 40, thickness = 4, className, ...rest }: CircularProgressProps) {
	const reduce = useReducedMotion();
	const determinate = typeof value === 'number';
	const pct = determinate ? clamp(value) : 25;
	const r = (size - thickness) / 2;
	const c = 2 * Math.PI * r;
	return (
		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={determinate ? Math.round(pct) : undefined}
			className={cn('inline-flex', className)}
			style={{ width: size, height: size }}
			{...rest}
		>
			<motion.svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				animate={!determinate && !reduce ? { rotate: 360 } : undefined}
				transition={!determinate && !reduce ? { duration: 1, ease: 'linear', repeat: Infinity } : undefined}
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={thickness}
					className="text-surface-2"
				/>
				<motion.circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={thickness}
					strokeLinecap="round"
					className="text-accent"
					strokeDasharray={c}
					initial={false}
					animate={{ strokeDashoffset: c * (1 - pct / 100) }}
					transition={reduce ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</motion.svg>
		</div>
	);
}
