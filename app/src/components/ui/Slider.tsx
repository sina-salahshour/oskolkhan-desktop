/** Slider: Radix Slider; pass `value`/`defaultValue` arrays (one entry = single, two = range). */
import * as React from 'react';
import * as RS from '@radix-ui/react-slider';
import { cn } from '../../lib/util/cn';
import { focusRing } from './_shared';

export type SliderSize = 'sm' | 'md';

export interface SliderProps extends React.ComponentPropsWithoutRef<typeof RS.Root> {
	/** Default 'md'. */
	size?: SliderSize;
}

const tracks: Record<SliderSize, string> = { sm: 'h-1', md: 'h-1.5' };
const thumbs: Record<SliderSize, string> = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4' };

export const Slider = React.forwardRef<HTMLSpanElement, SliderProps>(function Slider(
	{ size = 'md', className, value, defaultValue, min = 0, ...rest },
	ref,
) {
	const initial = value === undefined && defaultValue === undefined ? [min] : defaultValue;
	const count = (value ?? initial ?? [min]).length;
	return (
		<RS.Root
			ref={ref}
			min={min}
			value={value}
			defaultValue={initial}
			className={cn(
				'relative flex h-5 w-full touch-none select-none items-center cursor-pointer data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
				className,
			)}
			{...rest}
		>
			<RS.Track className={cn('relative grow overflow-hidden rounded-full bg-surface-2', tracks[size])}>
				<RS.Range className="absolute h-full rounded-full bg-accent" />
			</RS.Track>
			{Array.from({ length: count }, (_, i) => (
				<RS.Thumb
					key={i}
					className={cn(
						'block cursor-grab active:cursor-grabbing rounded-full border-2 border-accent bg-bg shadow transition-transform duration-150 hover:scale-110 active:scale-95',
						focusRing,
						thumbs[size],
					)}
				/>
			))}
		</RS.Root>
	);
});
