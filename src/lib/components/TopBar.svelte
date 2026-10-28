<script lang="ts">
	import { page } from '$app/state';
	import { i18n, t } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import { ads } from '$lib/stores/ads.svelte';
	import { session } from '$lib/stores/session.svelte';
	import Icon from './Icon.svelte';
	import IconButton from './IconButton.svelte';
	import Tooltip from './Tooltip.svelte';
	import AnimatedNumber from './AnimatedNumber.svelte';

	const TITLES: Record<string, string> = {
		'/': 'nav.home',
		'/explore': 'explore.title',
		'/search': 'nav.search',
		'/likes': 'likes.title',
		'/history': 'history.title',
		'/downloads': 'downloads.title',
		'/settings': 'settings.title',
		'/account': 'account.title',
		'/player': 'nav.home',
		'/title': 'nav.home'
	};

	let heading = $derived.by(() => {
		const p = page.url.pathname;
		const key = Object.keys(TITLES)
			.filter((k) => (k === '/' ? p === '/' : p.startsWith(k)))
			.sort((a, b) => b.length - a.length)[0];
		return key ? t(TITLES[key]) : t('app.name');
	});

	let showCoins = $derived(session.isLoggedIn && ads.data != null);
</script>

<header class="topbar glass">
	<div class="start">
		<IconButton
			icon="menu"
			label={t('nav.browse')}
			variant="ghost"
			onclick={() => (ui.sidebarCollapsed = !ui.sidebarCollapsed)}
		/>
		<h1 class="heading">{heading}</h1>
	</div>

	<button class="search" onclick={() => ui.openPalette()}>
		<Icon name="search" size={17} />
		<span class="ph">{t('cmd.placeholder')}</span>
		<kbd class="latin">⌘ K</kbd>
	</button>

	<div class="end">
		{#if showCoins}
			<Tooltip content={t('gamify.coins')}>
				<a class="coins" href="/account" aria-label={t('gamify.coins')}>
					<Icon name="coin" size={18} />
					<AnimatedNumber value={ads.coins} />
				</a>
			</Tooltip>
		{/if}
		<Tooltip content={i18n.lang === 'fa' ? 'English' : 'فارسی'}>
			<button class="lang" aria-label="language" onclick={() => i18n.toggle()}>
				<Icon name="globe" size={18} />
				<span class="latin">{i18n.lang.toUpperCase()}</span>
			</button>
		</Tooltip>
		<IconButton
			icon={ui.theme === 'dark' ? 'sun' : 'moon'}
			label={ui.theme === 'dark' ? t('settings.themeLight') : t('settings.themeDark')}
			variant="ghost"
			onclick={() => ui.toggleTheme()}
		/>
	</div>
</header>

<style>
	.topbar {
		block-size: var(--topbar-h);
		flex: none;
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding-inline: var(--sp-5);
		border-block-end: 1px solid var(--border);
		position: sticky;
		inset-block-start: 0;
		z-index: var(--z-sticky);
	}
	.start {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		min-inline-size: 0;
	}
	.heading {
		font-size: 1.15rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.search {
		flex: 1;
		max-inline-size: 460px;
		margin-inline: auto;
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		block-size: 40px;
		padding-inline: var(--sp-4);
		border-radius: var(--r-full);
		background: var(--surface-2);
		border: 1px solid var(--border);
		color: var(--text-dim);
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}
	.search:hover {
		border-color: var(--border-strong);
		background: var(--surface-1);
		box-shadow: var(--shadow-sm);
	}
	.search:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	.ph {
		flex: 1;
		text-align: start;
		font-size: 0.88rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	kbd {
		font-size: 0.7rem;
		font-weight: 700;
		padding-inline: 6px;
		padding-block: 2px;
		border-radius: var(--r-xs);
		background: var(--surface-3);
		border: 1px solid var(--border);
		color: var(--text-muted);
	}
	.end {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.coins {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		block-size: 38px;
		padding-inline: var(--sp-3);
		border-radius: var(--r-full);
		background: var(--accent-soft);
		border: 1px solid var(--border-accent);
		color: var(--coin);
		font-weight: 800;
		transition:
			transform var(--dur-fast) var(--ease),
			box-shadow var(--dur-fast) var(--ease);
	}
	.coins:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 16px var(--coin-glow);
	}
	.coins :global(.num) {
		font-size: 0.92rem;
	}
	.lang {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		block-size: 38px;
		padding-inline: var(--sp-3);
		border-radius: var(--r-md);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
	}
	.lang:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.lang:active {
		transform: scale(0.94);
	}
	.lang .latin {
		font-size: 0.72rem;
		font-weight: 700;
	}
</style>
