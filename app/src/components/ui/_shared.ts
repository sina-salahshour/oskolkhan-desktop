/**
 * Internal helpers shared by the UI primitives (not part of the public barrel).
 */
import { useCallback, useState } from 'react';
import type { MotionProps } from 'motion/react';

/** Required focus ring for every interactive element. */
export const focusRing =
	'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

/** Props that collide between React DOM attributes and motion components. */
export type MotionConflicts = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart';
export type MotionSafe<T> = Omit<T, MotionConflicts>;

/**
 * Tracks an open state that may be controlled or uncontrolled, so AnimatePresence
 * can be tied to Radix's `open` even when the consumer does not control it.
 */
export function useOpenState(
	open: boolean | undefined,
	defaultOpen: boolean | undefined,
	onOpenChange: ((open: boolean) => void) | undefined,
): [boolean, (open: boolean) => void] {
	const [internal, setInternal] = useState<boolean>(defaultOpen ?? false);
	const controlled = open !== undefined;
	const current = controlled ? (open as boolean) : internal;
	const handle = useCallback(
		(next: boolean) => {
			if (!controlled) setInternal(next);
			onOpenChange?.(next);
		},
		[controlled, onOpenChange],
	);
	return [current, handle];
}

type PresenceMotion = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>;

/** Fade + scale enter/exit; opacity-only and near-instant under reduced motion. */
export function overlayMotion(reduce: boolean | null, scale = 0.96): PresenceMotion {
	if (reduce) {
		return {
			initial: { opacity: 0 },
			animate: { opacity: 1 },
			exit: { opacity: 0 },
			transition: { duration: 0.01 },
		};
	}
	return {
		initial: { opacity: 0, scale },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale },
		transition: { duration: 0.15, ease: 'easeOut' },
	};
}

/** Fade-only variant (scrims). */
export function fadeMotion(reduce: boolean | null): PresenceMotion {
	return {
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
		transition: { duration: reduce ? 0.01 : 0.15 },
	};
}
