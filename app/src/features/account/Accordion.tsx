/** Simple accessible FAQ accordion (single-open), animated open/close. */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from '@lucide/react';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/util/cn';

export interface FaqEntry {
	id: string;
	q: string;
	a: string;
}

export function Accordion({ items }: { items: FaqEntry[] }) {
	const reduce = useReducedMotion();
	const [open, setOpen] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-2">
			{items.map((item) => {
				const isOpen = open === item.id;
				return (
					<div key={item.id} className="overflow-hidden rounded-lg border border-line bg-surface">
						<button
							type="button"
							aria-expanded={isOpen}
							onClick={() => setOpen(isOpen ? null : item.id)}
							className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
						>
							<span className="font-medium text-fg">{item.q}</span>
							<Icon
								icon={ChevronDown}
								size={18}
								className={cn('shrink-0 text-muted transition-transform', isOpen && 'rotate-180')}
							/>
						</button>
						<AnimatePresence initial={false}>
							{isOpen ? (
								<motion.div
									initial={reduce ? false : { height: 0, opacity: 0 }}
									animate={{ height: 'auto', opacity: 1 }}
									exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
									transition={{ duration: reduce ? 0 : 0.22, ease: 'easeOut' }}
									className="overflow-hidden"
								>
									<p className="whitespace-pre-line border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
										{item.a}
									</p>
								</motion.div>
							) : null}
						</AnimatePresence>
					</div>
				);
			})}
		</div>
	);
}
