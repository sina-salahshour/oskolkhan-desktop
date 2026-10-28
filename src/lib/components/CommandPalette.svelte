<script lang="ts">
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { t } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import { api } from '$lib/api';
	import type { GenericTitle } from '$lib/api';
	import Icon, { type IconName } from './Icon.svelte';

	interface Cmd {
		id: string;
		label: string;
		href: string;
		icon: IconName;
		sub?: string;
	}

	const PAGES: Cmd[] = [
		{ id: 'home', label: t('nav.home'), href: '/', icon: 'home' },
		{ id: 'explore', label: t('explore.title'), href: '/explore', icon: 'compass' },
		{ id: 'search', label: t('nav.search'), href: '/search', icon: 'search' },
		{ id: 'likes', label: t('likes.title'), href: '/likes', icon: 'heart' },
		{ id: 'history', label: t('history.title'), href: '/history', icon: 'clock' },
		{ id: 'downloads', label: t('downloads.title'), href: '/downloads', icon: 'download' },
		{ id: 'settings', label: t('settings.title'), href: '/settings', icon: 'settings' },
		{ id: 'account', label: t('account.title'), href: '/account', icon: 'user' }
	];

	let query = $state('');
	let titleResults = $state<GenericTitle[]>([]);
	let selected = $state(0);
	let input = $state<HTMLInputElement | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	let pageMatches = $derived(
		query.trim()
			? PAGES.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()))
			: PAGES
	);

	let flat = $derived([
		...pageMatches.map((p) => ({ kind: 'page' as const, href: p.href, cmd: p })),
		...titleResults.map((t) => ({ kind: 'title' as const, href: `/title/${t.id}`, title: t }))
	]);

	$effect(() => {
		if (ui.paletteOpen) {
			selected = 0;
			queueMicrotask(() => input?.focus());
		} else {
			query = '';
			titleResults = [];
		}
	});

	$effect(() => {
		const q = query.trim();
		if (timer) clearTimeout(timer);
		if (!q) {
			titleResults = [];
			return;
		}
		timer = setTimeout(async () => {
			try {
				const res = await api.search({ phrase: q, type: 0, ignoreTypes: [], page: 1 });
				titleResults = res.Titles.slice(0, 6);
			} catch {
				titleResults = [];
			}
		}, 180);
	});

	function go(href: string) {
		ui.closePalette();
		goto(href);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!ui.paletteOpen) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selected = Math.min(selected + 1, flat.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selected = Math.max(selected - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = flat[selected];
			if (item) go(item.href);
		} else if (e.key === 'Escape') {
			ui.closePalette();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if ui.paletteOpen}
	<div class="wrap" transition:fade={{ duration: 120 }}>
		<button class="scrim" aria-label="close" onclick={() => ui.closePalette()}></button>
		<div class="panel" transition:scale={{ duration: 180, start: 0.97 }}>
			<div class="search">
				<Icon name="search" size={19} />
				<input
					bind:this={input}
					bind:value={query}
					placeholder={t('cmd.placeholder')}
					spellcheck="false"
				/>
				<kbd>esc</kbd>
			</div>

			<div class="results">
				{#if flat.length === 0}
					<p class="none">{t('cmd.noResults')}</p>
				{:else}
					{#if pageMatches.length}
						<p class="grp">{t('cmd.pages')}</p>
						{#each pageMatches as p, i (p.id)}
							<button
								class="item"
								class:sel={selected === i}
								onclick={() => go(p.href)}
								onmouseenter={() => (selected = i)}
							>
								<Icon name={p.icon} size={18} />
								<span>{p.label}</span>
							</button>
						{/each}
					{/if}
					{#if titleResults.length}
						<p class="grp">{t('cmd.titles')}</p>
						{#each titleResults as tt, i (tt.id)}
							{@const idx = pageMatches.length + i}
							<button
								class="item"
								class:sel={selected === idx}
								onclick={() => go(`/title/${tt.id}`)}
								onmouseenter={() => (selected = idx)}
							>
								<Icon name="film" size={18} />
								<span>{tt.persian}</span>
								<small class="latin">{tt.titles[0] ?? ''}</small>
							</button>
						{/each}
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.wrap {
		position: fixed;
		inset: 0;
		z-index: var(--z-overlay);
		display: flex;
		justify-content: center;
		padding-block-start: 12vh;
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: var(--scrim);
		backdrop-filter: blur(5px);
		border: none;
	}
	.panel {
		position: relative;
		inline-size: min(620px, 92vw);
		max-block-size: 64vh;
		display: flex;
		flex-direction: column;
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding-inline: var(--sp-5);
		block-size: 60px;
		border-block-end: 1px solid var(--border);
		color: var(--text-dim);
	}
	.search input {
		flex: 1;
		min-inline-size: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
		font-size: 1.05rem;
	}
	kbd {
		font-size: 0.7rem;
		padding-inline: 6px;
		padding-block: 2px;
		border-radius: var(--r-xs);
		background: var(--surface-3);
		border: 1px solid var(--border);
	}
	.results {
		overflow-y: auto;
		padding: var(--sp-2);
	}
	.grp {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		padding-inline: var(--sp-3);
		padding-block: var(--sp-2);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		inline-size: 100%;
		padding-inline: var(--sp-3);
		block-size: 44px;
		border: none;
		background: transparent;
		color: var(--text);
		border-radius: var(--r-md);
		text-align: start;
		font-size: 0.92rem;
	}
	.item small {
		margin-inline-start: auto;
		color: var(--text-dim);
		font-size: 0.78rem;
	}
	.item.sel {
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	.none {
		padding: var(--sp-6);
		text-align: center;
		color: var(--text-dim);
	}
</style>
