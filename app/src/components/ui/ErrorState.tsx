/** ErrorState: error-styled EmptyState with optional retry button. */
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { RotateCcw, TriangleAlert } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Button } from './Button';
import { Icon } from './Icon';

export interface ErrorStateProps {
	/** Default: "Something went wrong". */
	title?: string;
	message?: string;
	onRetry?: () => void;
	/** Default: "Retry". */
	retryLabel?: string;
	/** Default: TriangleAlert. */
	icon?: LucideIcon;
	className?: string;
}

export function ErrorState({
	title = 'Something went wrong',
	message,
	onRetry,
	retryLabel = 'Retry',
	icon = TriangleAlert,
	className,
}: ErrorStateProps) {
	const reduce = useReducedMotion();
	return (
		<motion.div
			role="alert"
			className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
			initial={reduce ? false : { opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
		>
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
				<Icon icon={icon} size={28} />
			</div>
			<h3 className="text-base font-semibold text-fg">{title}</h3>
			{message ? <p className="max-w-sm text-sm text-muted">{message}</p> : null}
			{onRetry ? (
				<Button variant="outline" size="sm" leftIcon={RotateCcw} onClick={onRetry} className="mt-2">
					{retryLabel}
				</Button>
			) : null}
		</motion.div>
	);
}
