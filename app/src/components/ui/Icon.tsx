/**
 * Icon wrapper over @lucide/react. One icon set, no emoji (per design).
 * Pass a Lucide icon component as `icon`; size/stroke are normalized so icons
 * read consistently across the app. Honors `aria-label` for standalone icons;
 * decorative icons default to aria-hidden.
 */
import type { LucideIcon, LucideProps } from '@lucide/react';
import { cn } from '../../lib/util/cn';

export interface IconProps extends Omit<LucideProps, 'ref'> {
	icon: LucideIcon;
	/** px size (default 20). Also accepts a Tailwind size via className. */
	size?: number;
	label?: string;
}

export function Icon({ icon: Cmp, size = 20, label, className, strokeWidth = 1.75, ...rest }: IconProps) {
	return (
		<Cmp
			size={size}
			strokeWidth={strokeWidth}
			className={cn('shrink-0', className)}
			aria-hidden={label ? undefined : true}
			aria-label={label}
			role={label ? 'img' : undefined}
			{...rest}
		/>
	);
}

export type { LucideIcon };
