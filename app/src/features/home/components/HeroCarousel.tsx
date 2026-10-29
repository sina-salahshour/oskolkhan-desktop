/** Cinematic hero carousel: full-bleed backdrop with a Ken-Burns zoom, a scrim
 * veil (not gradient-heavy theming — a legibility scrim over the image), slide content, Embla-driven
 * auto-advance, and dot navigation. More -> title. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Info, Star } from '@lucide/react';
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

	const plugins = useMemo(
		() => (reduce ? [] : [Autoplay({ delay: 7000, stopOnInteraction: false })]),
		[reduce]
	);
	// The app renders RTL; Embla must be told so, or it computes LTR transforms
	// against an RTL track and only the first slide ends up visible.
	const direction = lang === 'fa' ? 'rtl' : 'ltr';
	const [viewportRef, embla] = useEmblaCarousel(
		{ loop: true, direction, duration: reduce ? 0 : 25 },
		plugins
	);

	useEffect(() => {
		if (!embla) return;
		const onSelect = () => setIndex(embla.selectedScrollSnap());
		onSelect();
		embla.on('select', onSelect).on('reInit', onSelect);
		return () => {
			embla.off('select', onSelect).off('reInit', onSelect);
		};
	}, [embla]);

	const scrollTo = useCallback((i: number) => embla?.scrollTo(i), [embla]);

	if (!items.length) return null;
	const genreList = preload.data?.genre ?? [];

	return (
		<section
			className="relative mb-8 min-h-[440px] overflow-hidden rounded-2xl shadow-lg"
			aria-roledescription="carousel"
		>
			<div ref={viewportRef} className="overflow-hidden">
				<div className="flex">
					{items.map((current, i) => {
						const active = i === index;
						const name = titleName(current);
						const genres = current.genres
							.map((g) => genreList[g])
							.filter(Boolean)
							.slice(0, 3);
						return (
							<div
								key={`${current.id}-${i}`}
								role="group"
								aria-roledescription="slide"
								aria-label={`${i + 1} / ${items.length}`}
								aria-hidden={!active}
								className="relative flex min-h-[440px] min-w-0 flex-[0_0_100%] items-end overflow-hidden"
							>
								{/* backdrop */}
								<motion.div
									aria-hidden="true"
									className="absolute inset-0 bg-cover bg-center"
									style={{
										backgroundColor: placeholderColor(current.id),
										backgroundImage: current.img ? `url(${backdrop(assetBase, current.img)})` : undefined
									}}
									initial={false}
									animate={{ scale: reduce || !active ? 1.08 : 1 }}
									transition={
										reduce || !active ? { duration: 0 } : { duration: 12, ease: 'easeOut' }
									}
								/>

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
										<Button asChild size="lg" variant="subtle" leftIcon={Info}>
											<Link to="/title/$id" params={{ id: String(current.id) }} tabIndex={active ? 0 : -1}>
												{t('common.more')}
											</Link>
										</Button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{items.length > 1 ? (
				<div className="absolute bottom-5 end-8 flex gap-2">
					{items.map((it, i) => (
						<button
							key={`${it.id}-${i}`}
							type="button"
							aria-label={`${t('common.next')} ${i + 1}`}
							aria-current={i === index}
							onClick={() => scrollTo(i)}
							className={`h-2.5 cursor-pointer rounded-full outline-none transition-all duration-300 focus-visible:ring-2 focus-visible:ring-accent ${
								i === index ? 'w-6 bg-accent' : 'w-2.5 bg-white/30 hover:bg-white/55'
							}`}
						/>
					))}
				</div>
			) : null}
		</section>
	);
}
