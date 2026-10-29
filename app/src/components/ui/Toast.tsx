/**
 * Toaster: renders the toast queue from the toast store. Accessible (aria-live),
 * flat cinematic surface with a tone-colored accent edge, motion in/out, honoring
 * reduced motion. Mount ONCE near the app root (providers do this).
 */
import { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from '@lucide/react';
import { useToastStore, type Toast as ToastModel, type ToastTone } from '../../lib/stores/toast';
import { Icon } from './Icon';
import { cn } from '../../lib/util/cn';

const TONE_ICON = {
	info: Info,
	success: CheckCircle2,
	warning: AlertTriangle,
	error: XCircle
} as const;

const TONE_ACCENT: Record<ToastTone, string> = {
	info: 'text-fg',
	success: 'text-success',
	warning: 'text-warning',
	error: 'text-danger'
};

function ToastRow({ toast, onDismiss }: { toast: ToastModel; onDismiss: (id: string) => void }) {
	const reduce = useReducedMotion();
	useEffect(() => {
		if (!toast.duration) return;
		const id = setTimeout(() => onDismiss(toast.id), toast.duration);
		return () => clearTimeout(id);
	}, [toast.id, toast.duration, onDismiss]);

	return (
		<motion.div
			layout={!reduce}
			initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
			animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
			exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
			transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
			role="status"
			aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
			className={cn(
				'pointer-events-auto flex w-80 max-w-[90vw] items-start gap-3 rounded-lg border border-line bg-surface p-3 shadow-lg'
			)}
		>
			<Icon icon={TONE_ICON[toast.tone]} size={20} className={cn('mt-0.5', TONE_ACCENT[toast.tone])} />
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium text-fg">{toast.title}</p>
				{toast.description && (
					<p className="mt-0.5 break-words text-xs text-muted">{toast.description}</p>
				)}
				{toast.action && (
					<button
						type="button"
						onClick={() => {
							toast.action?.onClick();
							onDismiss(toast.id);
						}}
						className="mt-2 text-xs font-medium text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
					>
						{toast.action.label}
					</button>
				)}
			</div>
			<button
				type="button"
				aria-label="Close"
				onClick={() => onDismiss(toast.id)}
				className="rounded-md p-1 text-subtle outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
			>
				<Icon icon={X} size={16} />
			</button>
		</motion.div>
	);
}

export function Toaster() {
	const toasts = useToastStore((s) => s.toasts);
	const dismiss = useToastStore((s) => s.dismiss);
	return (
		<div
			className="pointer-events-none fixed bottom-4 end-4 z-[100] flex flex-col gap-2"
			aria-live="polite"
		>
			<AnimatePresence initial={false}>
				{toasts.map((t) => (
					<ToastRow key={t.id} toast={t} onDismiss={dismiss} />
				))}
			</AnimatePresence>
		</div>
	);
}
