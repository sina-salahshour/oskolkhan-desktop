<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { session } from '$lib/stores/session.svelte';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';

	type Profile = Awaited<ReturnType<typeof api.adProfile>>;
	type Faq = Awaited<ReturnType<typeof api.faq>>['items'];

	let profile = $state<Profile | null>(null);
	let faq = $state<Faq>([]);
	let loading = $state(true);
	let error = $state('');
	let openIndex = $state<number | null>(null);
	let loggingOut = $state(false);

	async function load() {
		loading = true;
		error = '';
		try {
			const [f, p] = await Promise.all([
				api.faq(),
				session.isLoggedIn ? api.adProfile() : Promise.resolve(null)
			]);
			faq = f.items;
			profile = p;
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
		loggingOut = true;
		try {
			await session.logout();
			await goto('/auth');
		} finally {
			loggingOut = false;
		}
	}

	const name = $derived(
		session.isLoggedIn && !session.isGuest
			? session.displayName || t('account.guest')
			: t('account.guest')
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
		</section>

		{#if error}
			<ErrorState message={error} onretry={load} />
		{:else}
			<section class="stats">
				{#if loading}
					{#each [0, 1, 2] as i (i)}
						<Skeleton height="88px" radius="var(--r-lg)" />
					{/each}
				{:else if profile}
					<div class="tile">
						<Icon name="coin" size={22} />
						<strong>{profile.Coins}</strong>
						<span>{t('account.coins')}</span>
					</div>
					<div class="tile">
						<Icon name="crown" size={22} />
						<strong>{profile.VipLevel}</strong>
						<span>{t('account.vipLevel')}</span>
					</div>
					<div class="tile">
						<Icon name="star" size={22} />
						<strong>{session.current?.plan ?? 0}</strong>
						<span>{t('account.plan')}</span>
					</div>
				{/if}
			</section>

			<h2 class="section-title faq-title">{t('account.faq')}</h2>
			<div class="faq">
				{#if loading}
					{#each [0, 1, 2] as i (i)}
						<Skeleton height="52px" />
					{/each}
				{:else}
					{#each faq as item, i (item.id)}
						<div class="row" class:open={openIndex === i}>
							<button
								class="q"
								aria-expanded={openIndex === i}
								onclick={() => (openIndex = openIndex === i ? null : i)}
							>
								<span>{item.title1}</span>
								<Icon name="chevron-right" size={18} />
							</button>
							{#if openIndex === i}
								<p class="a">{item.title2}</p>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		{/if}

		{#if session.isLoggedIn}
			<div class="logout">
				<Button variant="danger" icon="arrow-left" loading={loggingOut} onclick={logout}>
					{t('account.logout')}
				</Button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.profile {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		margin-block: var(--sp-5);
		padding: var(--sp-5);
		background: linear-gradient(135deg, var(--surface-2), var(--surface-1));
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-md);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 68px;
		height: 68px;
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
	}
	.who h2 {
		font-size: 1.3rem;
		font-weight: 700;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--sp-4);
	}
	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		padding: var(--sp-4);
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		color: var(--accent);
		transition:
			transform var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
	}
	.tile:hover {
		transform: translateY(-2px);
		border-color: var(--accent);
	}
	.tile strong {
		font-size: 1.6rem;
		color: var(--text);
	}
	.tile span {
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.faq-title {
		margin-block: var(--sp-6) var(--sp-3);
	}
	.faq {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.row {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		overflow: hidden;
		transition: border-color var(--dur) var(--ease);
	}
	.row.open {
		border-color: var(--accent);
	}
	.q {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
		width: 100%;
		padding: var(--sp-4);
		text-align: start;
		color: var(--text);
		font-weight: 600;
	}
	.q :global(svg) {
		flex-shrink: 0;
		color: var(--text-dim);
		transition: transform var(--dur) var(--ease);
	}
	.row.open .q :global(svg) {
		transform: rotate(90deg);
	}
	.a {
		padding-inline: var(--sp-4);
		padding-block: 0 var(--sp-4);
		color: var(--text-muted);
		line-height: 1.7;
	}
	.logout {
		margin-block-start: var(--sp-6);
	}
</style>
