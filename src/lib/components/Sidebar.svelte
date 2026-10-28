<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import { session } from '$lib/stores/session.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import Tooltip from './Tooltip.svelte';

	interface NavItem {
		href: string;
		icon: IconName;
		key: string;
	}

	const primary: NavItem[] = [
		{ href: '/', icon: 'home', key: 'nav.home' },
		{ href: '/explore', icon: 'compass', key: 'nav.explore' },
		{ href: '/search', icon: 'search', key: 'nav.search' }
	];
	const library: NavItem[] = [
		{ href: '/likes', icon: 'heart', key: 'nav.likes' },
		{ href: '/history', icon: 'clock', key: 'nav.history' },
		{ href: '/downloads', icon: 'download', key: 'nav.downloads' }
	];
	const system: NavItem[] = [
		{ href: '/settings', icon: 'settings', key: 'nav.settings' },
		{ href: '/account', icon: 'user', key: 'nav.account' }
	];

	function isActive(href: string): boolean {
		const p = page.url.pathname;
		return href === '/' ? p === '/' : p.startsWith(href);
	}
</script>

<aside class="sidebar" class:collapsed={ui.sidebarCollapsed}>
	<div class="brand">
		<span class="logo"><Icon name="film" size={22} /></span>
		{#if !ui.sidebarCollapsed}
			<span class="word"><b>{t('app.name')}</b><small>{t('app.tagline')}</small></span>
		{/if}
	</div>

	<nav>
		{#snippet link(item: NavItem)}
			<a href={item.href} class:active={isActive(item.href)} aria-label={t(item.key)}>
				<span class="dot"></span>
				<Icon name={item.icon} size={20} />
				{#if !ui.sidebarCollapsed}<span class="txt">{t(item.key)}</span>{/if}
			</a>
		{/snippet}

		{#snippet group(items: NavItem[], heading?: string)}
			{#if heading && !ui.sidebarCollapsed}<p class="heading">{heading}</p>{/if}
			<ul>
				{#each items as item (item.href)}
					<li>
						{#if ui.sidebarCollapsed}
							<Tooltip content={t(item.key)} placement="right">{@render link(item)}</Tooltip>
						{:else}
							{@render link(item)}
						{/if}
					</li>
				{/each}
			</ul>
		{/snippet}

		{@render group(primary)}
		{@render group(library, t('nav.library'))}
		{@render group(system)}
	</nav>

	<a class="account" href="/account" title={session.displayName}>
		<span class="avatar"><Icon name="user" size={18} /></span>
		{#if !ui.sidebarCollapsed}
			<span class="who">
				<b>{session.isLoggedIn ? session.displayName : t('auth.login')}</b>
				<small>{session.current?.vip ? t('account.vipActive') : t('account.notVip')}</small>
			</span>
			{#if session.current?.vip}<span class="vip"><Icon name="crown" size={14} /></span>{/if}
		{/if}
	</a>
</aside>

<style>
	.sidebar {
		inline-size: var(--sidebar-w);
		block-size: 100%;
		flex: none;
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		padding: var(--sp-4);
		background: var(--bg-deep);
		border-inline-end: 1px solid var(--border);
		transition: inline-size var(--dur) var(--ease);
	}
	.collapsed {
		inline-size: var(--sidebar-w-collapsed);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding-inline: var(--sp-2);
		padding-block: var(--sp-2);
	}
	.logo {
		inline-size: 40px;
		block-size: 40px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: var(--r-md);
		background: linear-gradient(135deg, var(--accent-strong), var(--accent-dim));
		color: var(--on-accent);
		box-shadow: 0 4px 16px var(--accent-glow);
		transition: transform var(--dur) var(--ease-spring);
	}
	.brand:hover .logo {
		transform: rotate(-6deg) scale(1.05);
	}
	.word {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}
	.word b {
		font-family: var(--font-display);
		font-size: 1.05rem;
	}
	.word small {
		color: var(--text-dim);
		font-size: 0.72rem;
	}
	nav {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.heading {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		padding-inline: var(--sp-3);
		margin-block-end: var(--sp-2);
	}
	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding-inline: var(--sp-3);
		block-size: 42px;
		border-radius: var(--r-md);
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.92rem;
		transition:
			background var(--dur-fast) var(--ease),
			color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
		position: relative;
	}
	.collapsed nav a {
		justify-content: center;
	}
	nav a:hover {
		background: var(--surface-1);
		color: var(--text);
	}
	nav a:active {
		transform: scale(0.97);
	}
	nav a.active {
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	.dot {
		position: absolute;
		inset-inline-start: 0;
		inset-block: 50%;
		inline-size: 3px;
		block-size: 0;
		border-radius: var(--r-full);
		background: var(--accent);
		transform: translateY(-50%);
		transition:
			block-size var(--dur) var(--ease-spring),
			opacity var(--dur) var(--ease);
		opacity: 0;
	}
	nav a.active .dot {
		block-size: 22px;
		opacity: 1;
	}
	.account {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-2);
		border-radius: var(--r-md);
		border: 1px solid var(--border);
		background: var(--surface-1);
		transition:
			border-color var(--dur) var(--ease),
			transform var(--dur-fast) var(--ease);
	}
	.account:hover {
		border-color: var(--border-strong);
		transform: translateY(-1px);
	}
	.avatar {
		inline-size: 36px;
		block-size: 36px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: var(--r-full);
		background: var(--surface-3);
		color: var(--text-muted);
	}
	.who {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
		min-inline-size: 0;
		flex: 1;
	}
	.who b {
		font-size: 0.88rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.who small {
		font-size: 0.72rem;
		color: var(--text-dim);
	}
	.vip {
		display: grid;
		place-items: center;
		inline-size: 24px;
		block-size: 24px;
		flex: none;
		border-radius: var(--r-full);
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
</style>
