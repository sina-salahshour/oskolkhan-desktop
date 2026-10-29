/** A number that tweens to its target (locale-aware digits), static when reduced. */
import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform, useReducedMotion } from 'motion/react';
import { useI18n } from '@/i18n';
import { formatNumber } from '@/lib/util/format';

export function AnimatedNumber({ value, duration = 0.8 }: { value: number; duration?: number }) {
	const { lang } = useI18n();
	const reduce = useReducedMotion();
	const mv = useMotionValue(value);
	const text = useTransform(mv, (v) => formatNumber(Math.round(v), lang));

	useEffect(() => {
		if (reduce) {
			mv.set(value);
			return;
		}
		const controls = animate(mv, value, { duration, ease: 'easeOut' });
		return () => controls.stop();
	}, [value, duration, reduce, mv]);

	return <motion.span>{text}</motion.span>;
}
