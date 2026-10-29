/**
 * Watch-ad reward loop. Ads are out of scope — this only presents the reward UX:
 * a short simulated "watch", then it hands the earned coins back to the parent.
 */
import { useState } from 'react';
import { Clapperboard, Coins, Eye, Info } from '@lucide/react';
import { Button, Icon } from '@/components/ui';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';

export function RewardLoop({
	available,
	needVpn = false,
	amount = 50,
	adsToday = 0,
	onClaim
}: {
	available: boolean;
	needVpn?: boolean;
	amount?: number;
	adsToday?: number;
	onClaim?: (amount: number) => void;
}) {
	const { t, lang } = useI18n();
	const [busy, setBusy] = useState(false);
	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	const reduce =
		typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	function watch() {
		if (busy || !available) return;
		setBusy(true);
		setTimeout(
			() => {
				setBusy(false);
				onClaim?.(amount);
			},
			reduce ? 0 : 1300
		);
	}

	return (
		<div className="flex flex-col items-center gap-4 rounded-xl border border-accent/60 bg-accent-soft p-5 sm:flex-row">
			<div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg">
				<Icon icon={Clapperboard} size={26} />
			</div>
			<div className="min-w-0 flex-1 text-center sm:text-start">
				<p className="font-extrabold text-fg">{t('gamify.watchAd')}</p>
				<p className="mt-0.5 text-sm text-muted">{t('gamify.watchAdDesc')}</p>
				{adsToday > 0 ? (
					<p className="mt-2 inline-flex items-center gap-1 text-xs text-subtle">
						<Icon icon={Eye} size={13} />
						{t('gamify.adsToday', { n: digit(adsToday) })}
					</p>
				) : null}
			</div>
			<div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
				{needVpn ? (
					<p className="inline-flex items-center justify-center gap-1 text-xs text-warning">
						<Icon icon={Info} size={14} />
						{t('gamify.needVpn')}
					</p>
				) : !available ? (
					<p className="inline-flex items-center justify-center gap-1 text-xs text-warning">
						<Icon icon={Info} size={14} />
						{t('gamify.unavailable')}
					</p>
				) : null}
				<Button leftIcon={Coins} loading={busy} disabled={!available} onClick={watch}>
					{busy ? t('gamify.earning') : t('gamify.earnCoins', { n: digit(amount) })}
				</Button>
			</div>
		</div>
	);
}
