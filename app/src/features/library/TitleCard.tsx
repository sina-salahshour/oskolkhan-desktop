/** Poster card for a GenericTitle, with optional selection + resume-progress overlay. */
import { motion, useReducedMotion } from 'motion/react';
import { Link } from '@tanstack/react-router';
import { Check, Play, Star } from '@lucide/react';
import { Progress, Icon } from '@/components/ui';
import type { GenericTitle } from '@/lib/api';
import { useSessionStore } from '@/lib/stores/session';
import { poster, placeholderColor } from '@/lib/util/images';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { useSettingsStore } from '@/features/settings/store';
import { cn } from '@/lib/util/cn';

export function TitleCard({
	title,
	progress,
	selectMode = false,
	selected = false,
	onToggle,
	index = 0
}: {
	title: GenericTitle;
	/** 0..1 resume progress (history) */
	progress?: number;
	selectMode?: boolean;
	selected?: boolean;
	onToggle?: (id: number) => void;
	index?: number;
}) {
	const { lang } = useI18n();
	const reduce = useReducedMotion();
	const assetBase = useSessionStore((s) => s.status?.assetBase ?? '');
	const titleLang = useSettingsStore((s) => s.titleLang);

	const original = title.orgtitles?.[0] ?? title.titles?.[0] ?? title.persian;
	const name = titleLang === 'original' ? original || title.persian : title.persian || original;
	const src = poster(assetBase, title.img, 300);
	const rating = title.UserScore || title.MetaScore || 0;
	const year = title.Year ? (lang === 'fa' ? toFaDigits(String(title.Year)) : String(title.Year)) : '';
	const pct = progress != null ? Math.round(progress * 100) : null;

	const inner = (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.25, ease: 'easeOut', delay: reduce ? 0 : Math.min(index, 12) * 0.03 }}
			whileHover={reduce || selectMode ? undefined : { y: -4 }}
			className={cn(
				'group relative flex flex-col gap-2 rounded-xl outline-none',
				selectMode && 'cursor-pointer',
				selected && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
			)}
		>
			<div
				className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-line bg-surface-2"
				style={{ backgroundColor: placeholderColor(title.id) }}
			>
				{src ? (
					<img
						src={src}
						alt={name}
						loading="lazy"
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				) : null}
				{rating ? (
					<span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-md bg-overlay/70 px-1.5 py-0.5 text-xs font-semibold text-fg backdrop-blur-sm">
						<Icon icon={Star} size={12} className="text-accent" />
						<span dir="ltr">{(lang === 'fa' ? toFaDigits(rating.toFixed(1)) : rating.toFixed(1))}</span>
					</span>
				) : null}
				{pct != null ? (
					<div className="absolute inset-x-0 bottom-0 p-1.5">
						<Progress value={pct} size="sm" />
					</div>
				) : null}
				{selectMode ? (
					<div
						className={cn(
							'absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors',
							selected ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-overlay/60 text-transparent'
						)}
					>
						<Check size={14} strokeWidth={3} />
					</div>
				) : null}
			</div>

			<div className="flex min-w-0 flex-col gap-0.5 px-0.5">
				<p className="truncate text-sm font-medium text-fg">{name}</p>
				<div className="flex items-center gap-2 text-xs text-subtle">
					{year ? <span dir={lang === 'fa' ? 'rtl' : 'ltr'}>{year}</span> : null}
					{pct != null ? (
						<span className="inline-flex items-center gap-1 text-accent">
							<Icon icon={Play} size={11} />
							{lang === 'fa' ? toFaDigits(String(pct)) : pct}%
						</span>
					) : null}
				</div>
			</div>
		</motion.div>
	);

	if (selectMode) {
		return (
			<button
				type="button"
				aria-pressed={selected}
				aria-label={name}
				onClick={() => onToggle?.(title.id)}
				className="cursor-pointer rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
			>
				{inner}
			</button>
		);
	}

	return (
		<Link
			to="/title/$id"
			params={{ id: String(title.id) }}
			className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
		>
			{inner}
		</Link>
	);
}
