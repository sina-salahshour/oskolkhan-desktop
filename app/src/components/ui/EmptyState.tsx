/** EmptyState: centered icon + title + description + optional action. */
import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { Inbox } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';

export interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}

export function EmptyState({ icon = Inbox, title, description, action, className }: EmptyStateProps) {
	const reduce = useReducedMotion();
	return (
		<motion.div
			className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}
			initial={reduce ? false : { opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut' }}
		>
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted">
				<Icon icon={icon} size={28} />
			</div>
			<h3 className="text-base font-semibold text-fg">{title}</h3>
			{description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
			{action ? <div className="mt-2">{action}</div> : null}
		</motion.div>
	);
}
