/** Poster card for the Search titles grid. Feature-local copy. Links to /title/$id. */
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Play, Star } from '@lucide/react';
import type { GenericTitle } from '@/lib/api';
import { poster, placeholderColor } from '@/lib/util/images';
import { Badge, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAssetBase, loc, titleName, titleSub, epLabel, rankText, qualityBadges } from '../util';

export function TitleCard({ title, index = 0 }: { title: GenericTitle; index?: number }) {
	const { lang } = useI18n();
	const assetBase = useAssetBase();
	const reduce = useReducedMotion();
	const [loaded, setLoaded] = useState(false);
	const [failed, setFailed] = useState(false);

	const name = titleName(title);
	const sub = titleSub(title);
	const src = poster(assetBase, title.img);
	const badges = qualityBadges(title).slice(0, 2);
	const ep = epLabel(lang, title);

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				duration: reduce ? 0 : 0.3,
				delay: reduce ? 0 : Math.min(index, 12) * 0.03,
				ease: 'easeOut'
			}}
		>
			<Link
				to="/title/$id"
				params={{ id: String(title.id) }}
				aria-label={name}
				className="group block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
			>
				<motion.div
					className="relative aspect-[2/3] overflow-hidden rounded-lg border border-line shadow-sm"
					style={{ background: placeholderColor(title.id) }}
					whileHover={reduce ? undefined : { y: -4 }}
					transition={{ type: 'spring', stiffness: 400, damping: 30 }}
				>
					{src && !failed ? (
						<img
							src={src}
							alt={name}
							loading="lazy"
							decoding="async"
							onLoad={() => setLoaded(true)}
							onError={() => setFailed(true)}
							className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-105 ${
								loaded ? 'opacity-100' : 'opacity-0'
							}`}
						/>
					) : null}
					{!loaded ? (
						<span className="absolute inset-0 grid place-items-center p-3 text-center text-sm font-semibold text-fg/80">
							{name}
						</span>
					) : null}

					<div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/55 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
						<span className="grid h-12 w-12 scale-75 place-items-center rounded-full bg-accent text-accent-fg shadow-lg transition-transform duration-200 group-hover:scale-100 group-focus-visible:scale-100">
							<Icon icon={Play} size={20} />
						</span>
					</div>

					{title.rank > 0 ? (
						<div className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-xs font-bold text-accent backdrop-blur-sm">
							<Icon icon={Star} size={12} />
							{rankText(lang, title.rank)}
						</div>
					) : null}

					{badges.length ? (
						<div className="absolute end-2 top-2 flex flex-col items-end gap-1">
							{badges.map((b) => (
								<Badge key={b.label} variant={b.variant} size="sm">
									{b.label}
								</Badge>
							))}
						</div>
					) : null}

					{ep ? (
						<div className="absolute bottom-2 start-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-fg backdrop-blur-sm">
							{ep}
						</div>
					) : null}
				</motion.div>

				<div className="mt-2">
					<p className="truncate text-sm font-semibold text-fg" title={name}>
						{name}
					</p>
					<p className="mt-0.5 flex items-center gap-2 text-xs text-subtle">
						{sub ? <span className="truncate">{sub}</span> : null}
						{title.Year ? <span className="ms-auto">{loc(lang, title.Year)}</span> : null}
					</p>
				</div>
			</Link>
		</motion.div>
	);
}
