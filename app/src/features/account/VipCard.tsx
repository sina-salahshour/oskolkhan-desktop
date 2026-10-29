/** VIP / coins card with a progress ring to the next level and a perks list. */
import { Crown, Coins, Captions, ShieldCheck, Zap } from '@lucide/react';
import { Badge, CircularProgress, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { cn } from '@/lib/util/cn';
import { AnimatedNumber } from './AnimatedNumber';

const PERKS = [
	{ icon: Captions, key: 'gamify.perk4k' },
	{ icon: ShieldCheck, key: 'gamify.perkNoAds' },
	{ icon: Zap, key: 'gamify.perkEarly' }
] as const;

export function VipCard({
	vip,
	level,
	coins,
	step = 1000
}: {
	vip: boolean;
	level: number;
	coins: number;
	step?: number;
}) {
	const { t, lang } = useI18n();
	const intoLevel = coins % step;
	const toNext = step - intoLevel;
	const ratio = Math.round((intoLevel / step) * 100);
	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	return (
		<div className={cn('relative overflow-hidden rounded-xl border p-5', vip ? 'border-accent bg-accent-soft' : 'border-line bg-surface')}>
			<div className="mb-4 flex items-center justify-between">
				<div className="flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
						<Icon icon={Crown} size={22} />
					</span>
					<div>
						<p className="text-xs text-muted">{t('gamify.vipCard')}</p>
						<p className={cn('text-base font-extrabold', vip ? 'text-fg' : 'text-muted')}>
							{vip ? t('gamify.vipLevel', { n: digit(level) }) : t('gamify.notVipYet')}
						</p>
					</div>
				</div>
				{vip ? (
					<Badge variant="accent" size="md">
						VIP
					</Badge>
				) : null}
			</div>

			<div className="flex items-center gap-5">
				<div className="relative shrink-0">
					<CircularProgress value={ratio} size={104} thickness={9} />
					<div className="absolute inset-0 flex flex-col items-center justify-center">
						<span className="font-display text-2xl font-extrabold text-accent" dir="ltr">
							{digit(level)}
						</span>
						<span className="text-[0.6rem] uppercase tracking-wide text-subtle">{t('gamify.toNextLevel')}</span>
					</div>
				</div>

				<div className="min-w-0 flex-1">
					<p className="flex items-center gap-2 text-lg font-extrabold text-accent">
						<Icon icon={Coins} size={18} />
						<AnimatedNumber value={coins} />
						<span className="text-sm font-semibold text-muted">{t('gamify.coins')}</span>
					</p>
					<p className="mb-3 mt-1 text-sm text-muted">{t('gamify.coinsToNext', { n: digit(toNext) })}</p>
					<ul className="flex flex-col gap-1.5">
						{PERKS.map((p) => (
							<li key={p.key} className="flex items-center gap-2 text-sm text-muted">
								<Icon icon={p.icon} size={15} className="text-accent" />
								{t(p.key)}
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
