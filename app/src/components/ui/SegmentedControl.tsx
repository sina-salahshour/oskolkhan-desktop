/** SegmentedControl: single-select Radix ToggleGroup with a sliding layoutId highlight. */
import * as React from 'react';
import * as TG from '@radix-ui/react-toggle-group';
import { motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { focusRing } from './_shared';

export interface SegmentedOption {
	value: string;
	label: React.ReactNode;
	icon?: LucideIcon;
	disabled?: boolean;
}

export type SegmentedControlSize = 'sm' | 'md';

export interface SegmentedControlProps {
	value: string;
	onValueChange: (value: string) => void;
	options: SegmentedOption[];
	/** Default 'md'. */
	size?: SegmentedControlSize;
	disabled?: boolean;
	className?: string;
	'aria-label'?: string;
}

const sizes: Record<SegmentedControlSize, string> = {
	sm: 'h-7 px-2.5 text-xs gap-1.5',
	md: 'h-8 px-3 text-sm gap-2',
};

export function SegmentedControl({
	value,
	onValueChange,
	options,
	size = 'md',
	disabled,
	className,
	'aria-label': ariaLabel,
}: SegmentedControlProps) {
	const reduce = useReducedMotion();
	const id = React.useId();
	return (
		<TG.Root
			type="single"
			value={value}
			disabled={disabled}
			aria-label={ariaLabel}
			onValueChange={(v) => {
				if (v) onValueChange(v); // ignore deselect
			}}
			className={cn('inline-flex items-center gap-1 rounded-lg bg-surface-2 p-1', className)}
		>
			{options.map((opt) => {
				const active = opt.value === value;
				return (
					<TG.Item
						key={opt.value}
						value={opt.value}
						disabled={opt.disabled}
						className={cn(
							'relative inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150',
							'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
							active ? 'text-accent' : 'text-muted hover:text-fg',
							focusRing,
							sizes[size],
						)}
					>
						{active ? (
							<motion.div
								aria-hidden="true"
								layoutId={reduce ? undefined : `segmented-${id}`}
								className="absolute inset-0 rounded-md border border-accent bg-accent-soft"
								transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
							/>
						) : null}
						<span className="relative z-10 inline-flex items-center gap-[inherit]">
							{opt.icon ? <Icon icon={opt.icon} size={size === 'sm' ? 14 : 16} /> : null}
							{opt.label}
						</span>
					</TG.Item>
				);
			})}
		</TG.Root>
	);
}
