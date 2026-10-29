/** Spinner: rotating Loader2 (motion); CSS animate-spin fallback under reduced motion. */
import { motion, useReducedMotion } from 'motion/react';
import { Loader2 } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';

export interface SpinnerProps {
	/** px (default 20). */
	size?: number;
	className?: string;
	/** Accessible label (default "Loading"). */
	label?: string;
}

export function Spinner({ size = 20, className, label = 'Loading' }: SpinnerProps) {
	const reduce = useReducedMotion();
	if (reduce) {
		return (
			<span role="status" aria-label={label} className={cn('inline-flex text-accent', className)}>
				<Icon icon={Loader2} size={size} className="animate-spin" />
			</span>
		);
	}
	return (
		<motion.span
			role="status"
			aria-label={label}
			className={cn('inline-flex text-accent', className)}
			animate={{ rotate: 360 }}
			transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
		>
			<Icon icon={Loader2} size={size} />
		</motion.span>
	);
}
