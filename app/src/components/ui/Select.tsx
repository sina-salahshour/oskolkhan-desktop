/** Select: styled Radix Select (input-like trigger, surface content, Check indicator). */
import * as React from 'react';
import * as RS from '@radix-ui/react-select';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { focusRing, overlayMotion } from './_shared';

export const Select = RS.Root;
export const SelectValue = RS.Value;
export const SelectGroup = RS.Group;

export interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof RS.Trigger> {
	/** Red border. */
	invalid?: boolean;
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(function SelectTrigger(
	{ className, invalid = false, children, ...rest },
	ref,
) {
	return (
		<RS.Trigger
			ref={ref}
			aria-invalid={invalid || undefined}
			className={cn(
				'inline-flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-surface-2 px-3 text-start text-sm text-fg',
				'transition-colors duration-150 data-[placeholder]:text-subtle disabled:cursor-not-allowed disabled:opacity-50',
				invalid ? 'border-danger' : 'border-line hover:border-line-strong',
				focusRing,
				className,
			)}
			{...rest}
		>
			<span className="truncate">{children}</span>
			<RS.Icon asChild>
				<Icon icon={ChevronDown} size={16} className="text-muted" />
			</RS.Icon>
		</RS.Trigger>
	);
});

export type SelectContentProps = Omit<React.ComponentPropsWithoutRef<typeof RS.Content>, 'asChild'>;

/**
 * Content stays mounted by Radix (required so SelectValue can resolve the selected label),
 * so it animates on enter only.
 */
export const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(function SelectContent(
	{ className, children, position = 'popper', sideOffset = 6, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	return (
		<RS.Portal>
			<RS.Content asChild ref={ref} position={position} sideOffset={sideOffset} {...rest}>
				<motion.div
					className={cn(
						'z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-lg border border-line bg-surface text-fg shadow-lg',
						position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
						className,
					)}
					style={{ transformOrigin: 'var(--radix-select-content-transform-origin)' }}
					{...overlayMotion(reduce, 0.95)}
					exit={undefined}
				>
					<RS.Viewport className="p-1">{children}</RS.Viewport>
				</motion.div>
			</RS.Content>
		</RS.Portal>
	);
});

export type SelectItemProps = React.ComponentPropsWithoutRef<typeof RS.Item>;
export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem(
	{ className, children, ...rest },
	ref,
) {
	return (
		<RS.Item
			ref={ref}
			className={cn(
				'relative flex cursor-default select-none items-center rounded-md py-1.5 pe-8 ps-2 text-sm text-fg outline-none transition-colors',
				'data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
				className,
			)}
			{...rest}
		>
			<RS.ItemText>{children}</RS.ItemText>
			<span className="absolute end-2 inline-flex h-4 w-4 items-center justify-center">
				<RS.ItemIndicator>
					<Icon icon={Check} size={14} className="text-accent" />
				</RS.ItemIndicator>
			</span>
		</RS.Item>
	);
});

export type SelectLabelProps = React.ComponentPropsWithoutRef<typeof RS.Label>;
export const SelectLabel = React.forwardRef<HTMLDivElement, SelectLabelProps>(function SelectLabel(
	{ className, ...rest },
	ref,
) {
	return (
		<RS.Label
			ref={ref}
			className={cn('px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle', className)}
			{...rest}
		/>
	);
});

export type SelectSeparatorProps = React.ComponentPropsWithoutRef<typeof RS.Separator>;
export const SelectSeparator = React.forwardRef<HTMLDivElement, SelectSeparatorProps>(function SelectSeparator(
	{ className, ...rest },
	ref,
) {
	return <RS.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-line', className)} {...rest} />;
});
