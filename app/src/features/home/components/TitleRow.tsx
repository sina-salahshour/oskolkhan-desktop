/** A horizontally-scrolling row of poster cards with a title, optional "see all"
 * link (to /explore?more=endpoint) and prev/next scroll controls (RTL-aware). */
import { useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from '@lucide/react';
import type { GenericTitle } from '@/lib/api';
import { IconButton, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { TitleCard } from './TitleCard';

export interface TitleRowProps {
	title: string;
	items: GenericTitle[];
	moreEndpoint?: string;
	progressFor?: (t: GenericTitle) => number | undefined;
}

export function TitleRow({ title, items, moreEndpoint, progressFor }: TitleRowProps) {
	const { t, dir } = useI18n();
	const rtl = dir === 'rtl';
	const scroller = useRef<HTMLDivElement>(null);

	const nudge = (d: 1 | -1) => {
		const el = scroller.current;
		if (!el) return;
		const amount = Math.round(el.clientWidth * 0.8) * d * (rtl ? -1 : 1);
		el.scrollBy({ left: amount, behavior: 'smooth' });
	};

	if (!items.length) return null;

	return (
		<section className="mb-8">
			<header className="mb-3 flex items-center justify-between gap-3">
				<h2 className="text-lg font-semibold text-fg">{title}</h2>
				<div className="flex items-center gap-2">
					{moreEndpoint ? (
						<Link
							to="/explore"
							search={{ more: moreEndpoint } as never}
							className="inline-flex items-center gap-0.5 px-2 text-sm font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent"
						>
							{t('common.seeAll')}
							<Icon icon={rtl ? ChevronLeft : ChevronRight} size={15} />
						</Link>
					) : null}
					<IconButton
						icon={rtl ? ChevronRight : ChevronLeft}
						label={t('common.prev')}
						variant="subtle"
						size="sm"
						onClick={() => nudge(-1)}
					/>
					<IconButton
						icon={rtl ? ChevronLeft : ChevronRight}
						label={t('common.next')}
						variant="subtle"
						size="sm"
						onClick={() => nudge(1)}
					/>
				</div>
			</header>

			<div
				ref={scroller}
				className="grid grid-flow-col gap-4 overflow-x-auto pb-2 [grid-auto-columns:clamp(130px,14vw,172px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{items.map((item, i) => (
					<div key={`${item.id}-${i}`} className="scroll-snap-align-start">
						<TitleCard title={item} index={i} progress={progressFor?.(item)} />
					</div>
				))}
			</div>
		</section>
	);
}
