/** RatingChip: compact source + score pill (IMDb, Meta, Rotten, ...). */
import * as React from 'react';
import type { LucideIcon } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';

export type RatingTone = 'default' | 'gold';

export interface RatingChipProps extends React.HTMLAttributes<HTMLSpanElement> {
	source: string;
	score: string | number;
	icon?: LucideIcon;
	/** 'gold' tints the score/icon with the accent color. Default 'default'. */
	tone?: RatingTone;
}

export const RatingChip = React.forwardRef<HTMLSpanElement, RatingChipProps>(function RatingChip(
	{ source, score, icon, tone = 'default', className, ...rest },
	ref,
) {
	const gold = tone === 'gold';
	return (
		<span
			ref={ref}
			className={cn(
				'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border border-line bg-surface px-2 text-xs',
				className,
			)}
			{...rest}
		>
			{icon ? <Icon icon={icon} size={12} className={gold ? 'text-accent' : 'text-muted'} /> : null}
			<span className="font-medium text-muted">{source}</span>
			<span className={cn('font-semibold', gold ? 'text-accent' : 'text-fg')}>{score}</span>
		</span>
	);
});
