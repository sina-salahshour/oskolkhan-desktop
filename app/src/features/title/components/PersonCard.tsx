import { motion, useReducedMotion } from 'motion/react';
import { Avatar } from '../../../components/ui';
import { person } from '../../../lib/util/images';
import type { tti } from '../../../lib/api/types';

export function PersonCard({ p, assetBase, index }: { p: tti; assetBase: string; index: number }) {
	const reduce = useReducedMotion();
	return (
		<motion.li
			className="flex flex-col items-center gap-2 rounded-lg border border-line bg-surface p-3 text-center transition-colors hover:border-line-strong"
			initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0.01 : 0.28, delay: reduce ? 0 : Math.min(index, 11) * 0.03 }}
			whileHover={reduce ? undefined : { y: -3 }}
		>
			<Avatar src={person(assetBase, p.img)} name={p.title1} alt={p.title1} size={64} />
			<div className="min-w-0 max-w-full">
				<div className="truncate text-sm font-medium text-fg">{p.title1}</div>
				{p.title2 ? <div className="truncate text-xs text-muted">{p.title2}</div> : null}
			</div>
		</motion.li>
	);
}
