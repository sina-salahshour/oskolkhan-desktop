/** List-view result row: poster thumb + rich metadata (name, rank, sub/year/ep/
 * votes, genres, description). Links to /title/$id with an RTL-aware hover chevron. */
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Star } from '@lucide/react';
import type { GenericTitle } from '@/lib/api';
import { poster, placeholderColor } from '@/lib/util/images';
import { Icon } from '@/components/ui';
import { formatCompact } from '@/lib/util/format';
import { useI18n } from '@/i18n';
import {
	useAssetBase,
	loc,
	titleName,
	titleSub,
	epLabel,
	rankText,
	usePreloadLookups
} from '../util';

export function ResultRow({ title, index = 0 }: { title: GenericTitle; index?: number }) {
	const { lang, dir } = useI18n();
	const rtl = dir === 'rtl';
	const assetBase = useAssetBase();
	const reduce = useReducedMotion();
	const lookups = usePreloadLookups();
	const [loaded, setLoaded] = useState(false);
	const [failed, setFailed] = useState(false);

	const name = titleName(title);
	const sub = titleSub(title);
	const src = poster(assetBase, title.img);
	const ep = epLabel(lang, title);
	const genres = lookups.genres(title.genres).slice(0, 3);

	return (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : Math.min(index, 12) * 0.03 }}
		>
			<Link
				to="/title/$id"
				params={{ id: String(title.id) }}
				aria-label={name}
				className="group flex items-stretch gap-4 rounded-lg border border-line bg-surface p-3 outline-none transition-colors hover:border-line-strong hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
			>
				<div
					className="relative aspect-[2/3] w-16 flex-none overflow-hidden rounded-md"
					style={{ background: placeholderColor(title.id) }}
				>
					{src && !failed ? (
						<img
							src={src}
							alt={name}
							loading="lazy"
							decoding="async"
							onLoad={() => setLoaded(true)}
							onError={() => setFailed(true)}
							className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
								loaded ? 'opacity-100' : 'opacity-0'
							}`}
						/>
					) : null}
				</div>

				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex items-center gap-3">
						<p className="min-w-0 truncate text-base font-bold text-fg" title={name}>
							{name}
						</p>
						{title.rank > 0 ? (
							<span className="ms-auto inline-flex flex-none items-center gap-1 font-bold text-accent">
								<Icon icon={Star} size={13} />
								{rankText(lang, title.rank)}
							</span>
						) : null}
					</div>
					<p className="flex items-center gap-2 text-sm text-muted">
						{sub ? <span className="max-w-[50%] truncate">{sub}</span> : null}
						{title.Year ? <span>{loc(lang, title.Year)}</span> : null}
						{ep ? <span>· {ep}</span> : null}
						{title.votes > 0 ? <span>· {formatCompact(title.votes, lang)}</span> : null}
					</p>
					{genres.length ? (
						<p className="text-sm text-accent/90">{genres.join(' · ')}</p>
					) : null}
					{title.Description ? (
						<p className="line-clamp-2 text-sm text-subtle">{title.Description}</p>
					) : null}
				</div>

				<span className="grid flex-none place-items-center text-subtle transition-transform group-hover:text-accent">
					<Icon icon={rtl ? ChevronLeft : ChevronRight} size={18} />
				</span>
			</Link>
		</motion.div>
	);
}
