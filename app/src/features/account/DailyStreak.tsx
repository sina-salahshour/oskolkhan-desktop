/** Daily-reward streak: 7 day cells (oldest→today) + a flame counter + claim CTA. */
import { motion, useReducedMotion } from 'motion/react';
import { Flame, Check, CheckCircle2, Gift } from '@lucide/react';
import { Button, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { cn } from '@/lib/util/cn';

export function DailyStreak({
	days,
	today,
	claiming = false,
	onClaim
}: {
	/** 7 days oldest→today; the final slot is today */
	days: boolean[];
	today: boolean;
	claiming?: boolean;
	onClaim?: () => void;
}) {
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();
	const cells = [...days.slice(0, -1), today];
	const lastIndex = cells.length - 1;

	let streak = 0;
	for (let i = cells.length - 1; i >= 0; i--) {
		if (cells[i]) streak++;
		else break;
	}
	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	return (
		<div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
			<header className="flex items-center gap-3">
				<div
					className={cn(
						'relative flex h-11 w-11 items-center justify-center rounded-lg',
						streak > 0 ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-subtle'
					)}
				>
					<Icon icon={Flame} size={22} />
					<span className="absolute -bottom-1 -end-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[0.68rem] font-extrabold text-accent-fg" dir="ltr">
						{digit(streak)}
					</span>
				</div>
				<div>
					<p className="font-extrabold text-fg">{t('gamify.dailyStreak')}</p>
					<p className="text-sm text-muted">{t('gamify.streakDays', { n: digit(streak) })}</p>
				</div>
			</header>

			<div className="grid grid-cols-7 gap-2">
				{cells.map((done, i) => (
					<div key={i} className="flex flex-col items-center gap-1">
						<motion.span
							initial={reduce || !done ? false : { scale: 0.5, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ delay: reduce ? 0 : i * 0.04, type: 'spring', stiffness: 500, damping: 24 }}
							className={cn(
								'grid aspect-square w-full max-w-[38px] place-items-center rounded-md border',
								done ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface-2 text-transparent',
								i === lastIndex && 'ring-2 ring-accent/50'
							)}
						>
							<Check size={13} strokeWidth={3} />
						</motion.span>
						<span className={cn('text-[0.66rem]', i === lastIndex ? 'font-bold text-accent' : 'text-subtle')}>
							{i === lastIndex ? t('gamify.today') : digit(i + 1)}
						</span>
					</div>
				))}
			</div>

			{today ? (
				<p className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-success">
					<Icon icon={CheckCircle2} size={16} />
					{t('gamify.claimed')}
				</p>
			) : (
				<Button fullWidth leftIcon={Gift} loading={claiming} onClick={() => onClaim?.()}>
					{t('gamify.claim')}
				</Button>
			)}
		</div>
	);
}
