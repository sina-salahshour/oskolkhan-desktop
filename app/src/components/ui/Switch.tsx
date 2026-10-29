/** Switch (alias Toggle): Radix Switch with a motion layout-animated thumb. */
import * as React from 'react';
import * as RS from '@radix-ui/react-switch';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';
import { focusRing } from './_shared';

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof RS.Root> {
	/** Default 'md'. */
	size?: SwitchSize;
}

const tracks: Record<SwitchSize, string> = { sm: 'h-5 w-9', md: 'h-6 w-11' };
const thumbs: Record<SwitchSize, string> = { sm: 'h-4 w-4', md: 'h-5 w-5' };

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
	{ size = 'md', className, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	return (
		<RS.Root
			ref={ref}
			className={cn(
				'inline-flex shrink-0 cursor-pointer items-center rounded-full border border-line px-0.5 transition-colors duration-150',
				'data-[state=unchecked]:bg-surface-2 data-[state=checked]:justify-end data-[state=checked]:border-accent data-[state=checked]:bg-accent',
				'disabled:cursor-not-allowed disabled:opacity-50',
				focusRing,
				tracks[size],
				className,
			)}
			{...rest}
		>
			<RS.Thumb asChild>
				<motion.span
					layout
					transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 600, damping: 35 }}
					className={cn('block rounded-full bg-fg shadow', thumbs[size])}
				/>
			</RS.Thumb>
		</RS.Root>
	);
});

export const Toggle = Switch;
export type ToggleProps = SwitchProps;
