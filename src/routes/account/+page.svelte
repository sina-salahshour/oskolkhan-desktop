<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { session } from '$lib/stores/session.svelte';
	import { ads } from '$lib/stores/ads.svelte';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Accordion from '$lib/components/Accordion.svelte';
	import VipCard from '$lib/components/gamify/VipCard.svelte';
	import DailyStreak from '$lib/components/gamify/DailyStreak.svelte';
	import RewardLoop from '$lib/components/gamify/RewardLoop.svelte';

	type FaqItems = Awaited<ReturnType<typeof api.faq>>['items'];

	let faq = $state<FaqItems>([]);
	let loading = $state(true);
	let error = $state('');
	let claiming = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const [f] = await Promise.all([
				api.faq(),
				session.isLoggedIn ? ads.init() : Promise.resolve()
			]);
			faq = f.items;
		} catch (e) {
			error = (e as { message?: string })?.message || t('common.retry');
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	async function logout() {
		await session.logout();
		await goto('/auth');
	}

	function claimDaily() {
		claiming = true;
		// optimistic — the store awards coins + fires the celebration toast.
		setTimeout(() => {
			ads.claimDaily(100);
			claiming = false;
		}, 350);
	}

	const name = $derived(
		session.isLoggedIn && !session.isGuest
			? session.displayName || t('account.guest')
			: t('account.guest')
	);

	let faqItems = $derived(
		faq.map((item) => ({ id: String(item.id), q: item.title1, a: item.title2 }))
	);
</script>

<div class="page">
	<h1 class="section-title">{t('account.title')}</h1>

	{#if !session.isLoggedIn && !session.loading}
		<EmptyState icon="user" title={t('account.guest')} description={t('auth.subtitle')}>
			{#snippet action()}
				<Button variant="primary" icon="arrow-right" href="/auth">{t('auth.login')}</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<section class="profile">
			<div class="avatar"><Icon name="user" size={34} /></div>
			<div class="who">
				<h2>{name}</h2>
				{#if session.current?.vip}
					<Badge tone="gold">{t('account.vipActive')}</Badge>
				{:else}
					<Badge tone="neutral">{t('account.notVip')}</Badge>
				{/if}
			</div>
			{#if session.isLoggedIn}
				<Button variant="ghost" icon="logout" onclick={logout}>{t('account.logout')}</Button>
			{/if}
		</section>

		{#if error}
			<ErrorState message={error} onretry={load} />
		{:else if loading || !ads.data}
			<div class="gamegrid">
				<Skeleton height="220px" radius="var(--r-lg)" />
				<Skeleton height="220px" radius="var(--r-lg)" />
			</div>
		{:else}
			<section class="gamegrid stagger-in" style="--i:0">
				<VipCard vip={ads.vip} level={ads.vipLevel} coins={ads.coins} />
				<DailyStreak days={ads.weekDays} today={ads.claimedToday} {claiming} onclaim={claimDaily} />
			</section>

			<section class="stagger-in" style="--i:1">
				<RewardLoop
					available={ads.nextAdAvailable}
					needVpn={ads.nextAdNeedsVpn}
					amount={50}
					adsToday={ads.adsToday}
					onclaim={(n) => ads.collectAdReward(n)}
				/>
			</section>
		{/if}

		<section class="faq stagger-in" style="--i:2">
			<h2 class="section-title faq-title"><Icon name="info" size={20} />{t('account.faq')}</h2>
			{#if loading}
				<div class="faqsk">
					{#each [0, 1, 2] as i (i)}<Skeleton height="52px" />{/each}
				</div>
			{:else if faqItems.length}
				<Accordion items={faqItems} />
			{/if}
		</section>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
	}
	.profile {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-5);
		background: linear-gradient(135deg, var(--surface-2), var(--surface-1));
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-md);
	}
	.avatar {
		display: grid;
		place-items: center;
		inline-size: 68px;
		block-size: 68px;
		flex: none;
		border-radius: 50%;
		background: var(--accent-soft);
		color: var(--accent);
		border: 1px solid var(--accent);
	}
	.who {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--sp-2);
		flex: 1;
		min-inline-size: 0;
	}
	.who h2 {
		font-size: 1.3rem;
		font-weight: 700;
	}
	.gamegrid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: var(--sp-4);
	}
	.faq-title {
		margin-block-end: var(--sp-3);
	}
	.faqsk {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	@media (max-width: 640px) {
		.profile {
			flex-wrap: wrap;
		}
	}
</style>
