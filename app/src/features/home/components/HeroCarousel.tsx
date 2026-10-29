/** Cinematic hero carousel: full-bleed backdrop with a Ken-Burns zoom, a scrim
 * veil (not gradient-heavy theming — a legibility scrim over the image), crossfaded
 * content, auto-advance, and dot navigation. Play -> player, More -> title. */
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Play, Info, Star } from '@lucide/react';
import type { GenericTitle } from '@/lib/api';
import { backdrop, placeholderColor } from '@/lib/util/images';
import { Button, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { usePreload } from '@/lib/query';
import { useAssetBase, loc, titleName, rankText } from '../util';

export interface HeroCarouselProps {
	items: GenericTitle[];
}

export function HeroCarousel({ items }: HeroCarouselProps) {
	const { t, lang } = useI18n();
	const assetBase = useAssetBase();
	const reduce = useReducedMotion();
	const preload = usePreload();
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (items.length <= 1) return;
		const id = setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
		return () => clearInterval(id);
	}, [items.length]);

	if (!items.length) return null;
	const current = items[index] ?? items[0];
	const name = titleName(current);
	const genreList = preload.data?.genre ?? [];
	const genres = current.genres
		.map((g) => genreList[g])
		.filter(Boolean)
		.slice(0, 3);

	return (
		<section className="relative mb-8 flex min-h-[440px] items-end overflow-hidden rounded-2xl shadow-lg">
			{/* backdrop */}
			<AnimatePresence initial={false}>
				<motion.div
					key={current.id}
					aria-hidden="true"
					className="absolute inset-0 bg-cover bg-center"
					style={{
						backgroundColor: placeholderColor(current.id),
						backgroundImage: current.img ? `url(${backdrop(assetBase, current.img)})` : undefined
					}}
					initial={{ opacity: 0, scale: reduce ? 1 : 1.08 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0 }}
					transition={{ opacity: { duration: reduce ? 0.1 : 0.6 }, scale: { duration: 12, ease: 'easeOut' } }}
				/>
			</AnimatePresence>

			{/* legibility scrim */}
			<div
				className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent"
				aria-hidden="true"
			/>
			<div
				className="absolute inset-0 bg-gradient-to-l from-bg/70 to-transparent"
				aria-hidden="true"
			/>

			{/* content */}
			<div className="relative max-w-[640px] p-8">
				<AnimatePresence mode="wait">
					<motion.div
						key={current.id}
						initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: reduce ? 0.12 : 0.25, ease: 'easeOut' }}
					>
						<span className="mb-3 inline-flex items-center gap-2 text-sm font-bold tracking-wide text-accent">
							<Icon icon={Star} size={14} />
							{t('home.hero.badge')}
						</span>
						<h2 className="mb-3 text-[clamp(2rem,4vw,3rem)] font-extrabold leading-[1.05] text-fg [text-shadow:0_2px_20px_rgba(0,0,0,0.5)]">
							{name}
						</h2>
						<div className="mb-2 flex items-center gap-4 font-semibold text-muted">
							{current.rank > 0 ? (
								<span className="inline-flex items-center gap-1 text-accent">
									<Icon icon={Star} size={14} />
									{rankText(lang, current.rank)}
								</span>
							) : null}
							{current.Year ? <span>{loc(lang, current.Year)}</span> : null}
						</div>
						{genres.length ? <p className="mb-3 text-muted">{genres.join(' · ')}</p> : null}
						{current.Description ? (
							<p className="mb-5 line-clamp-3 leading-relaxed text-fg/90">{current.Description}</p>
						) : null}
						<div className="flex gap-3">
							<Button asChild size="lg" leftIcon={Play}>
								<Link to="/player" search={{ id: current.id } as never}>
									{t('common.play')}
								</Link>
							</Button>
							<Button asChild size="lg" variant="subtle" leftIcon={Info}>
								<Link to="/title/$id" params={{ id: String(current.id) }}>
									{t('common.more')}
								</Link>
							</Button>
						</div>
					</motion.div>
				</AnimatePresence>
			</div>

			{items.length > 1 ? (
				<div className="absolute bottom-5 end-8 flex gap-2">
					{items.map((it, i) => (
						<button
							key={`${it.id}-${i}`}
							type="button"
							aria-label={`${t('common.next')} ${i + 1}`}
							aria-current={i === index}
							onClick={() => setIndex(i)}
							className={`h-2.5 rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-accent ${
								i === index ? 'w-6 bg-accent' : 'w-2.5 bg-white/30 hover:bg-white/55'
							}`}
						/>
					))}
				</div>
			) : null}
		</section>
	);
}
