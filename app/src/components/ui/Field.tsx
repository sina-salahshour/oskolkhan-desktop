/** Form primitives: Input, Textarea, Label, Field (label + control + hint/error). */
import * as React from 'react';
import * as RL from '@radix-ui/react-label';
import type { LucideIcon } from '@lucide/react';
import { cn } from '../../lib/util/cn';
import { Icon } from './Icon';
import { focusRing } from './_shared';

const controlBase =
	'w-full rounded-md border bg-surface-2 text-sm text-fg placeholder:text-subtle transition-colors duration-150 ' +
	'disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
	/** Danger border + aria-invalid. */
	invalid?: boolean;
	leftIcon?: LucideIcon;
	rightIcon?: LucideIcon;
	/** Class for the outer wrapper (only rendered when an icon is present). */
	wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
	{ invalid = false, leftIcon, rightIcon, className, wrapperClassName, ...rest },
	ref,
) {
	const input = (
		<input
			ref={ref}
			aria-invalid={invalid || undefined}
			className={cn(
				controlBase,
				'h-10 px-3',
				invalid ? 'border-danger' : 'border-line hover:border-line-strong',
				leftIcon && 'ps-9',
				rightIcon && 'pe-9',
				focusRing,
				className,
			)}
			{...rest}
		/>
	);
	if (!leftIcon && !rightIcon) return input;
	return (
		<div className={cn('relative w-full', wrapperClassName)}>
			{leftIcon ? (
				<span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-subtle">
					<Icon icon={leftIcon} size={16} />
				</span>
			) : null}
			{input}
			{rightIcon ? (
				<span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-subtle">
					<Icon icon={rightIcon} size={16} />
				</span>
			) : null}
		</div>
	);
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ invalid = false, className, rows = 4, ...rest },
	ref,
) {
	return (
		<textarea
			ref={ref}
			rows={rows}
			aria-invalid={invalid || undefined}
			className={cn(
				controlBase,
				'min-h-[5rem] resize-y px-3 py-2',
				invalid ? 'border-danger' : 'border-line hover:border-line-strong',
				focusRing,
				className,
			)}
			{...rest}
		/>
	);
});

export type LabelProps = React.ComponentPropsWithoutRef<typeof RL.Root>;
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
	{ className, ...rest },
	ref,
) {
	return <RL.Root ref={ref} className={cn('text-sm font-medium text-fg', className)} {...rest} />;
});

export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
	label?: React.ReactNode;
	htmlFor?: string;
	hint?: React.ReactNode;
	error?: React.ReactNode;
	required?: boolean;
	children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, children, className, ...rest }: FieldProps) {
	return (
		<div className={cn('flex flex-col gap-1.5', className)} {...rest}>
			{label ? (
				<Label htmlFor={htmlFor}>
					{label}
					{required ? (
						<span aria-hidden="true" className="ms-0.5 text-danger">
							*
						</span>
					) : null}
				</Label>
			) : null}
			{children}
			{error ? (
				<p role="alert" className="text-xs text-danger">
					{error}
				</p>
			) : hint ? (
				<p className="text-xs text-muted">{hint}</p>
			) : null}
		</div>
	);
}
