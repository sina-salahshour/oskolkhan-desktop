/**
 * Account screen: profile, VIP/coins + restrained gamification (streak, reward
 * loop, animated coins, a tasteful level-up confetti moment), FAQ accordion and
 * logout. Default export = AccountScreen (router wires it to /account).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UserRound, LogOut, Info, ArrowLeft, HelpCircle } from '@lucide/react';
import {
	Avatar,
	Badge,
	Button,
	EmptyState,
	ErrorState,
	Skeleton,
	Icon
} from '@/components/ui';
import { useSession, useAdProfile, useFaq, useLogout } from '@/lib/query';
import { useSessionStore } from '@/lib/stores/session';
import { isApiError } from '@/lib/api';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { toast } from '@/lib/stores/toast';
import { VipCard } from './VipCard';
import { DailyStreak } from './DailyStreak';
import { RewardLoop } from './RewardLoop';
import { Accordion, type FaqEntry } from './Accordion';
import { Confetti } from './Confetti';

const STEP = 1000;

export default function AccountScreen() {
	const { t, lang } = useI18n();
	const navigate = useNavigate();

	const sessionQuery = useSession();
	const session = sessionQuery.data ?? null;
	const loggedIn = useSessionStore((s) => s.loggedIn());

	const adProfile = useAdProfile({ enabled: loggedIn });
	const faq = useFaq();
	const logout = useLogout();

	const baseCoins = adProfile.data?.Coins ?? 0;
	const baseLevel = adProfile.data?.VipLevel ?? 0;
	const vip = adProfile.data?.Vip ?? session?.vip ?? false;

	const [bonus, setBonus] = useState(0);
	const [levelBump, setLevelBump] = useState(0);
	const [claimedToday, setClaimedToday] = useState(false);
	const [claiming, setClaiming] = useState(false);
	const [confettiKey, setConfettiKey] = useState(0);

	// reset local bonus if the server coin total changes under us
	useEffect(() => {
		setBonus(0);
		setLevelBump(0);
	}, [baseCoins]);

	const coins = baseCoins + bonus;
	const level = baseLevel + levelBump;
	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	const todayClaimed = (adProfile.data?.Today ?? false) || claimedToday;
	const weekDays = useMemo(() => {
		const d = adProfile.data;
		return [
			d?.DayMinus6 ?? false,
			d?.DayMinus5 ?? false,
			d?.DayMinus4 ?? false,
			d?.DayMinus3 ?? false,
			d?.DayMinus2 ?? false,
			d?.DayMinus1 ?? false,
			todayClaimed
		];
	}, [adProfile.data, todayClaimed]);

	function addCoins(n: number) {
		const before = Math.floor(coins / STEP);
		const after = Math.floor((coins + n) / STEP);
		setBonus((b) => b + n);
		if (after > before) {
			const gained = after - before;
			setLevelBump((l) => l + gained);
			setConfettiKey((k) => k + 1);
			toast({ tone: 'success', title: t('gamify.levelUp', { n: digit(level + gained) }) });
		} else {
			toast({ tone: 'success', title: t('gamify.rewardEarned'), description: t('gamify.coinsAdded', { n: digit(n) }) });
		}
	}

	function claimDaily() {
		if (todayClaimed) return;
		setClaiming(true);
		setTimeout(() => {
			setClaimedToday(true);
			addCoins(100);
			setClaiming(false);
		}, 350);
	}

	async function doLogout() {
		await logout.mutateAsync();
		void navigate({ to: '/auth' });
	}

	const faqItems: FaqEntry[] = (faq.data?.items ?? []).map((it) => ({
		id: String(it.id),
		q: it.title1,
		a: it.title2
	}));

	const displayName =
		session && session.name ? `${session.name} ${session.family}`.trim() : t('account.guest');

	// not signed in
	if (!loggedIn && !sessionQuery.isLoading) {
		return (
			<div className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center px-4">
				<EmptyState
					icon={UserRound}
					title={t('account.guest')}
					description={t('auth.subtitle')}
					action={
						<Button leftIcon={ArrowLeft} onClick={() => navigate({ to: '/auth' })}>
							{t('auth.login')}
						</Button>
					}
				/>
			</div>
		);
	}

	const gamifyLoading = adProfile.isLoading || !adProfile.data;

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
			<h1 className="text-2xl font-extrabold text-fg">{t('account.title')}</h1>

			<section className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5">
				<Avatar name={displayName} size={64} />
				<div className="flex min-w-0 flex-1 flex-col items-start gap-2">
					<h2 className="truncate text-xl font-bold text-fg">{displayName}</h2>
					{vip ? (
						<Badge variant="accent">{t('account.vipActive')}</Badge>
					) : (
						<Badge variant="neutral">{t('account.notVip')}</Badge>
					)}
				</div>
				<Button variant="ghost" leftIcon={LogOut} loading={logout.isPending} onClick={doLogout}>
					{t('account.logout')}
				</Button>
			</section>

			{adProfile.isError ? (
				<ErrorState
					message={isApiError(adProfile.error) ? adProfile.error.message : undefined}
					retryLabel={t('common.retry')}
					onRetry={() => void adProfile.refetch()}
				/>
			) : gamifyLoading ? (
				<div className="grid gap-4 sm:grid-cols-2">
					<Skeleton rounded="xl" className="h-56" />
					<Skeleton rounded="xl" className="h-56" />
				</div>
			) : (
				<>
					<div className="relative">
						<Confetti fireKey={confettiKey} />
						<div className="grid gap-4 sm:grid-cols-2">
							<VipCard vip={vip} level={level} coins={coins} step={STEP} />
							<DailyStreak days={weekDays} today={todayClaimed} claiming={claiming} onClaim={claimDaily} />
						</div>
					</div>

					<RewardLoop
						available={adProfile.data?.NextADSavailable ?? false}
						needVpn={adProfile.data?.NextADSneedVPN ?? false}
						amount={50}
						adsToday={adProfile.data?.TodayAds ?? 0}
						onClaim={(n) => addCoins(n)}
					/>
				</>
			)}

			<section className="flex flex-col gap-3">
				<h2 className="flex items-center gap-2 text-lg font-bold text-fg">
					<Icon icon={HelpCircle} size={20} />
					{t('account.faq')}
				</h2>
				{faq.isLoading ? (
					<div className="flex flex-col gap-2">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} rounded="lg" className="h-12" />
						))}
					</div>
				) : faq.isError ? (
					<ErrorState
						icon={Info}
						message={isApiError(faq.error) ? faq.error.message : undefined}
						retryLabel={t('common.retry')}
						onRetry={() => void faq.refetch()}
					/>
				) : faqItems.length > 0 ? (
					<Accordion items={faqItems} />
				) : null}
			</section>
		</div>
	);
}
