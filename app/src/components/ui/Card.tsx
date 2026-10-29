/** Card surface with Header/Title/Body(Content)/Footer subcomponents. */
import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';
import { focusRing, type MotionSafe } from './_shared';

export interface CardProps extends MotionSafe<React.HTMLAttributes<HTMLDivElement>> {
	/** Hover elevation + subtle scale; also focusable when onClick is provided. */
	interactive?: boolean;
}

const base = 'rounded-xl border border-line bg-surface text-fg';

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
	{ interactive = false, className, children, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	if (!interactive) {
		return (
			<div ref={ref} className={cn(base, className)} {...rest}>
				{children}
			</div>
		);
	}
	return (
		<motion.div
			ref={ref}
			className={cn(
				base,
				'cursor-pointer transition-shadow duration-150 hover:border-line-strong hover:shadow-lg',
				focusRing,
				className,
			)}
			whileHover={reduce ? undefined : { scale: 1.02 }}
			whileTap={reduce ? undefined : { scale: 0.99 }}
			{...rest}
		>
			{children}
		</motion.div>
	);
});

export type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader(
	{ className, ...rest },
	ref,
) {
	return <div ref={ref} className={cn('flex flex-col gap-1 p-4 pb-0', className)} {...rest} />;
});

export type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
	{ className, ...rest },
	ref,
) {
	return <h3 ref={ref} className={cn('text-base font-semibold leading-tight text-fg', className)} {...rest} />;
});

export type CardBodyProps = React.HTMLAttributes<HTMLDivElement>;
export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(function CardBody(
	{ className, ...rest },
	ref,
) {
	return <div ref={ref} className={cn('p-4 text-sm text-muted', className)} {...rest} />;
});
export const CardContent = CardBody;
export type CardContentProps = CardBodyProps;

export type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;
export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter(
	{ className, ...rest },
	ref,
) {
	return <div ref={ref} className={cn('flex items-center gap-2 p-4 pt-0', className)} {...rest} />;
});
