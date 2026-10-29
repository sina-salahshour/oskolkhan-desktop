/** Avatar: Radix Avatar with initials fallback. */
import * as React from 'react';
import * as RA from '@radix-ui/react-avatar';
import { cn } from '../../lib/util/cn';

export type AvatarSize = 'sm' | 'md' | 'lg' | number;

export interface AvatarProps extends Omit<React.ComponentPropsWithoutRef<typeof RA.Root>, 'children'> {
	src?: string;
	name?: string;
	/** 'sm' 28px, 'md' 36px (default), 'lg' 48px, or px number. */
	size?: AvatarSize;
	alt?: string;
}

const presets = { sm: 28, md: 36, lg: 48 } as const;

function initials(name?: string): string {
	if (!name) return '?';
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	const first = Array.from(parts[0])[0] ?? '';
	const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? '') : '';
	return (first + last).toUpperCase();
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
	{ src, name, size = 'md', alt, className, style, ...rest },
	ref,
) {
	const px = typeof size === 'number' ? size : presets[size];
	return (
		<RA.Root
			ref={ref}
			className={cn('inline-flex shrink-0 select-none overflow-hidden rounded-full bg-surface-2', className)}
			style={{ width: px, height: px, ...style }}
			{...rest}
		>
			{src ? <RA.Image src={src} alt={alt ?? name ?? ''} className="h-full w-full object-cover" /> : null}
			<RA.Fallback
				delayMs={src ? 300 : 0}
				className="flex h-full w-full items-center justify-center font-medium text-muted"
				style={{ fontSize: Math.max(10, Math.round(px * 0.4)) }}
			>
				{initials(name)}
			</RA.Fallback>
		</RA.Root>
	);
});
