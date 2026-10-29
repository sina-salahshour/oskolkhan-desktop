/** Skeleton shimmer placeholder (opacity pulse; static under reduced motion) and SkeletonText. */
import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';
import type { MotionSafe } from './_shared';

export type SkeletonRounded = 'none' | 'md' | 'lg' | 'xl' | 'full';

export interface SkeletonProps extends MotionSafe<React.HTMLAttributes<HTMLDivElement>> {
	rounded?: SkeletonRounded;
}

const radii: Record<SkeletonRounded, string> = {
	none: 'rounded-none',
	md: 'rounded-md',
	lg: 'rounded-lg',
	xl: 'rounded-xl',
	full: 'rounded-full',
};

export function Skeleton({ rounded = 'md', className, ...rest }: SkeletonProps) {
	const reduce = useReducedMotion();
	return (
		<motion.div
			aria-hidden="true"
			className={cn('bg-surface-2', radii[rounded], className)}
			animate={reduce ? undefined : { opacity: [1, 0.5, 1] }}
			transition={reduce ? undefined : { duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
			{...rest}
		/>
	);
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Number of lines (default 3). The last line is shorter. */
	lines?: number;
	lineClassName?: string;
}

export function SkeletonText({ lines = 3, className, lineClassName, ...rest }: SkeletonTextProps) {
	return (
		<div className={cn('flex flex-col gap-2', className)} {...rest}>
			{Array.from({ length: lines }, (_, i) => (
				<Skeleton
					key={i}
					className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full', lineClassName)}
				/>
			))}
		</div>
	);
}
