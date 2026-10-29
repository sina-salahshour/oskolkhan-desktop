/** Tabs: Radix Tabs with a shared-layout (layoutId) animated underline on the active trigger. */
import * as React from 'react';
import * as RT from '@radix-ui/react-tabs';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/util/cn';
import { focusRing } from './_shared';

interface TabsCtx {
	value: string | undefined;
	layoutId: string;
}
const TabsContext = React.createContext<TabsCtx>({ value: undefined, layoutId: 'tabs-indicator' });

export type TabsProps = React.ComponentPropsWithoutRef<typeof RT.Root>;

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
	{ value, defaultValue, onValueChange, ...rest },
	ref,
) {
	const id = React.useId();
	const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
	const controlled = value !== undefined;
	const current = controlled ? value : internal;
	const handle = (v: string) => {
		if (!controlled) setInternal(v);
		onValueChange?.(v);
	};
	return (
		<TabsContext.Provider value={{ value: current, layoutId: `tabs-indicator-${id}` }}>
			<RT.Root ref={ref} value={current} onValueChange={handle} {...rest} />
		</TabsContext.Provider>
	);
});

export type TabsListProps = React.ComponentPropsWithoutRef<typeof RT.List>;
export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(function TabsList(
	{ className, ...rest },
	ref,
) {
	return <RT.List ref={ref} className={cn('flex items-center gap-1 border-b border-line', className)} {...rest} />;
});

export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof RT.Trigger>;
export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
	{ className, children, value, ...rest },
	ref,
) {
	const reduce = useReducedMotion();
	const ctx = React.useContext(TabsContext);
	const active = ctx.value === value;
	return (
		<RT.Trigger
			ref={ref}
			value={value}
			className={cn(
				'relative inline-flex h-10 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors duration-150',
				'rounded-t-md text-muted hover:text-fg data-[state=active]:text-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
				focusRing,
				className,
			)}
			{...rest}
		>
			{children}
			{active ? (
				<motion.div
					aria-hidden="true"
					layoutId={reduce ? undefined : ctx.layoutId}
					className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent"
					transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
				/>
			) : null}
		</RT.Trigger>
	);
});

export type TabsContentProps = React.ComponentPropsWithoutRef<typeof RT.Content>;
export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent(
	{ className, ...rest },
	ref,
) {
	return <RT.Content ref={ref} className={cn('mt-4', focusRing, className)} {...rest} />;
});
