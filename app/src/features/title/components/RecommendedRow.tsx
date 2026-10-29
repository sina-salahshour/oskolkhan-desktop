import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { titleImage, placeholderColor } from '../../../lib/util/images';
import type { tti } from '../../../lib/api/types';

export function RecommendedRow({ items, assetBase }: { items: tti[]; assetBase: string }) {
	const reduce = useReducedMotion();
	return (
		<ul className="grid grid-cols-3 gap-3 lg:grid-cols-2">
			{items.slice(0, 12).map((r, i) => {
				const src = titleImage(assetBase, r.img);
				return (
					<motion.li
						key={r.id}
						initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: reduce ? 0.01 : 0.26, delay: reduce ? 0 : Math.min(i, 11) * 0.03 }}
						whileHover={reduce ? undefined : { y: -4 }}
					>
						<Link
							to="/title/$id"
							params={{ id: String(r.id) }}
							className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<div
								className="aspect-[2/3] overflow-hidden rounded-lg border border-line shadow-sm transition-shadow group-hover:shadow-lg"
								style={{ background: placeholderColor(r.id) }}
							>
								{src ? <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
							</div>
							<div className="mt-1.5 line-clamp-2 text-xs text-fg">{r.title1}</div>
						</Link>
					</motion.li>
				);
			})}
		</ul>
	);
}
