<script lang="ts">
	import { page } from '$app/state';
	import { i18n, t } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import Icon from './Icon.svelte';

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

	const metaKey = '⌘';
</script>

<header class="topbar glass">
	<div class="start">
		<button
			class="icon-btn"
			aria-label="toggle sidebar"
			onclick={() => (ui.sidebarCollapsed = !ui.sidebarCollapsed)}
		>
			<Icon name="menu" size={20} />
		</button>
		<h1 class="heading">{heading}</h1>
	</div>

	<button class="search" onclick={() => ui.openPalette()}>
		<Icon name="search" size={17} />
		<span class="ph">{t('cmd.placeholder')}</span>
		<kbd class="latin">{metaKey} K</kbd>
	</button>

	<div class="end">
		<button class="icon-btn" aria-label="language" onclick={() => i18n.toggle()}>
			<Icon name="globe" size={19} />
			<span class="lang latin">{i18n.lang.toUpperCase()}</span>
		</button>
		<button class="icon-btn" aria-label="theme" onclick={() => ui.toggleTheme()}>
			<Icon name={ui.theme === 'dark' ? 'sun' : 'moon'} size={19} />
		</button>
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
	.icon-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		block-size: 38px;
		padding-inline: var(--sp-3);
		border-radius: var(--r-md);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-muted);
		transition: all var(--dur-fast) var(--ease);
	}
	.icon-btn:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.lang {
		font-size: 0.72rem;
		font-weight: 700;
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
		transition: all var(--dur-fast) var(--ease);
	}
	.search:hover {
		border-color: var(--border-strong);
		background: var(--surface-1);
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
</style>
