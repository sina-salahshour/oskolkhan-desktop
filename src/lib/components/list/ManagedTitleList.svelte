<script lang="ts">
	import { errorText } from '$lib/util/err';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { GenericTitle, GetMore } from '$lib/api';
	import { t } from '$lib/i18n';
	import { digits } from '$lib/util/format';
	import type { IconName } from '$lib/components/Icon.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import TitleCard from '$lib/components/TitleCard.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Progress from '$lib/components/Progress.svelte';
	import Modal from '$lib/components/Modal.svelte';

	interface Props {
		heading: string;
		emptyIcon: IconName;
		emptyTitle: string;
		load: () => Promise<GetMore>;
		remove: (id: number) => Promise<void>;
		/** show pseudo watch progress + resume hint */
		showProgress?: boolean;
	}
	let { heading, emptyIcon, emptyTitle, load, remove, showProgress = false }: Props = $props();

	let items = $state<GenericTitle[]>([]);
	let loading = $state(true);
	let error = $state('');
	let selectMode = $state(false);
	let confirmOpen = $state(false);
	let deleting = $state(false);
	const selected = new SvelteSet<number>();

	async function fetchItems() {
		loading = true;
		error = '';
		try {
			const res = await load();
			items = res.items;
		} catch (e) {
			error = errorText(e);
		} finally {
			loading = false;
		}
	}
	onMount(fetchItems);

	function progressOf(id: number): number {
		return 0.2 + (id % 5) * 0.15;
	}
	function toggleMode() {
		selectMode = !selectMode;
		selected.clear();
	}
	function toggle(id: number) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}
	function selectAll() {
		for (const it of items) selected.add(it.id);
	}
	async function confirmDelete() {
		deleting = true;
		const ids = [...selected];
		const done: number[] = [];
		for (const id of ids) {
			try {
				await remove(id);
				done.push(id);
			} catch {
				// keep failed items in the list
			}
		}
		items = items.filter((it) => !done.includes(it.id));
		selected.clear();
		deleting = false;
		confirmOpen = false;
		if (items.length === 0) selectMode = false;
	}
</script>

<div class="page">
	<header class="head">
		<h1 class="section-title">{heading}</h1>
		{#if !loading && !error && items.length > 0}
			<Button
				variant={selectMode ? 'outline' : 'secondary'}
				size="sm"
				icon={selectMode ? 'x' : 'check'}
				onclick={toggleMode}
			>
				{selectMode ? t('common.cancel') : t('list.multiDelete')}
			</Button>
		{/if}
	</header>

	{#if selectMode}
		<div class="toolbar">
			<span class="count">{digits(selected.size)} {t('common.selected')}</span>
			<div class="actions">
				<Button variant="ghost" size="sm" onclick={selectAll}>{t('common.selectAll')}</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={selected.size === 0}
					onclick={() => selected.clear()}
				>
					{t('common.clear')}
				</Button>
				<Button
					variant="danger"
					size="sm"
					icon="trash"
					disabled={selected.size === 0}
					onclick={() => (confirmOpen = true)}
				>
					{t('common.delete')}
				</Button>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="grid">
			{#each Array(12) as _, i (i)}
				<div class="sk">
					<Skeleton height="225px" radius="var(--r-md)" />
					<Skeleton height="0.9rem" width="75%" />
					<Skeleton height="0.7rem" width="45%" />
				</div>
			{/each}
		</div>
	{:else if error}
		<ErrorState message={error} onretry={fetchItems} />
	{:else if items.length === 0}
		<EmptyState icon={emptyIcon} title={emptyTitle} />
	{:else}
		<div class="grid">
			{#each items as it, i (`${it.id}-${i}`)}
				<div
					class="cell stagger-in"
					style="--i:{Math.min(i, 12)}"
					class:selectable={selectMode}
					class:picked={selected.has(it.id)}
				>
					<TitleCard title={it} progress={showProgress ? progressOf(it.id) : undefined} />
					{#if showProgress && !selectMode}
						<div class="resume">
							<Progress value={progressOf(it.id) * 100} tone="accent" height="3px" />
							<p class="resume-text">
								<Icon name="play" size={12} />
								{t('history.continueFrom', {
									t: digits(Math.round(progressOf(it.id) * 100)) + '%'
								})}
							</p>
						</div>
					{/if}
					{#if selectMode}
						<button
							type="button"
							class="pick"
							aria-pressed={selected.has(it.id)}
							aria-label={it.persian}
							onclick={() => toggle(it.id)}
						>
							<span class="box">
								{#if selected.has(it.id)}<Icon name="check" size={16} />{/if}
							</span>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={confirmOpen} title={t('common.confirm')}>
	<p class="confirm-text">{t('list.deleteConfirm')}</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (confirmOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="danger" icon="trash" loading={deleting} onclick={confirmDelete}>
			{t('common.delete')}
		</Button>
	{/snippet}
</Modal>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
		margin-block-end: var(--sp-5);
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--sp-3);
		padding-inline: var(--sp-4);
		padding-block: var(--sp-3);
		margin-block-end: var(--sp-5);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
	}
	.count {
		color: var(--accent);
		font-weight: 700;
	}
	.actions {
		display: flex;
		gap: var(--sp-2);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--sp-4);
	}
	.sk {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.cell {
		position: relative;
		border-radius: var(--r-md);
		transition: opacity var(--dur) var(--ease);
	}
	.cell.selectable:not(.picked) {
		opacity: 0.75;
	}
	.cell.picked {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.resume {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		margin-block-start: var(--sp-2);
	}
	.resume-text {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--text-muted);
		font-size: 0.74rem;
	}
	.pick {
		position: absolute;
		inset: 0;
		border-radius: var(--r-md);
		cursor: pointer;
		background: transparent;
	}
	.box {
		position: absolute;
		inset-block-start: var(--sp-2);
		inset-inline-end: var(--sp-2);
		display: grid;
		place-items: center;
		inline-size: 24px;
		block-size: 24px;
		border-radius: var(--r-xs);
		background: var(--scrim);
		border: 2px solid var(--border-strong);
		color: var(--on-accent);
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease),
			transform var(--dur) var(--ease-spring);
	}
	.picked .box {
		background: var(--accent);
		border-color: var(--accent);
		transform: scale(1.12);
	}
	.pick:active .box {
		transform: scale(0.85);
	}
	.confirm-text {
		color: var(--text-muted);
	}
</style>
