import { motion, useReducedMotion } from 'motion/react';
import { Heart, Star } from '@lucide/react';
import { Badge, IconButton } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { backdrop, placeholderColor, poster } from '../../../lib/util/images';
import type { GenericTitle, ItemDetail, PreLoad } from '../../../lib/api/types';
import { titleQualityBadges } from '../lib/badges';
import { compact, rankText, runtime, year } from '../lib/format';

export interface TitleHeaderProps {
	title: GenericTitle;
	detail: ItemDetail | undefined;
	pre: PreLoad | undefined;
	assetBase: string;
	liked: boolean;
	onToggleLike: () => void;
}

export function TitleHeader(p: TitleHeaderProps) {
	const { title, detail, pre, assetBase } = p;
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();
	const bg = backdrop(assetBase, title.img);
	const pos = poster(assetBase, title.img, 300);
	const alt = title.orgtitles[0] || title.titles[0] || '';
	const secondary = alt && alt !== title.persian ? alt : '';
	const country = detail ? (pre?.countries?.[detail.country] ?? '') : '';
	const facts: string[] = [
		year(title.Year, lang),
		detail ? runtime(detail.runtime, lang) : '',
		country
	].filter(Boolean);
	const genres = title.genres.map((g) => pre?.genre?.[g] ?? '').filter(Boolean);
	const badges = titleQualityBadges(title);

	return (
		<header
			className="relative overflow-hidden rounded-xl border border-line"
			style={{ background: placeholderColor(title.id) }}
		>
			{bg ? <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
			<div className="absolute inset-0 bg-bg/80" />
			<div className="relative flex flex-col gap-6 p-5 sm:flex-row sm:p-8">
				<motion.div
					className="mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-lg border border-line-strong shadow-lg sm:mx-0 sm:w-52"
					style={{ background: placeholderColor(title.id) }}
					initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: reduce ? 0.01 : 0.3 }}
				>
					{pos ? <img src={pos} alt={title.persian} className="h-full w-full object-cover" /> : null}
				</motion.div>
				<div className="flex min-w-0 flex-1 flex-col justify-end gap-3">
					<div>
						<h1 className="text-2xl font-bold text-fg sm:text-4xl">{title.persian}</h1>
						{secondary ? <p className="mt-1 text-sm text-muted" dir="ltr">{secondary}</p> : null}
					</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
						{title.rank > 0 ? (
							<span className="inline-flex items-center gap-1 font-medium text-accent">
								<Star size={14} fill="currentColor" />
								{rankText(title.rank, lang)}
							</span>
						) : null}
						{facts.map((f) => (
							<span key={f}>{f}</span>
						))}
						{title.votes > 0 ? <span>{compact(title.votes, lang)} ★</span> : null}
					</div>
					{genres.length > 0 || badges.length > 0 || title.MustSee ? (
						<div className="flex flex-wrap items-center gap-1.5">
							{title.MustSee ? <Badge variant="warning">{t('title.mustSee')}</Badge> : null}
							{badges.map((b) => (
								<Badge key={b.label} variant={b.variant}>
									{b.label}
								</Badge>
							))}
							{genres.map((g) => (
								<span key={g} className="rounded-full border border-line bg-surface/60 px-2.5 py-0.5 text-xs text-fg">
									{g}
								</span>
							))}
						</div>
					) : null}
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<motion.span
							key={p.liked ? 'on' : 'off'}
							className="inline-flex"
							initial={reduce ? false : { scale: p.liked ? 0.7 : 1 }}
							animate={{ scale: 1 }}
							transition={{ type: 'spring', stiffness: 500, damping: 12 }}
						>
							<IconButton
								icon={Heart}
								label={p.liked ? t('common.liked') : t('common.like')}
								variant="outline"
								size="lg"
								aria-pressed={p.liked}
								className={
									p.liked
										? 'border-danger bg-danger/15 text-danger [&_svg]:fill-current'
										: undefined
								}
								onClick={p.onToggleLike}
							/>
						</motion.span>
					</div>
				</div>
			</div>
		</header>
	);
}
