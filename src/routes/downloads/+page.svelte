<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { downloads } from '$lib/stores/downloads.svelte';
	import { digits } from '$lib/util/format';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Field from '$lib/components/Field.svelte';
	import Toggle from '$lib/components/Toggle.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import QueueRow from '$lib/components/downloads/QueueRow.svelte';

	type Tab = 'queue' | 'library' | 'groups';

	let tab = $state<Tab>('queue');
	let selecting = $state(false);
	let confirmOpen = $state(false);
	let groupOpen = $state(false);

	let gName = $state('');
	let gFolder = $state('');
	let gChunks = $state(4);
	let gAuto = $state(false);
	let gSchedule = $state('');

	let canSave = $derived(gName.trim().length > 0 && gFolder.trim().length > 0);
	let allSelected = $derived(
		downloads.queue.length > 0 && downloads.queue.every((q) => downloads.selected.has(q.id))
	);

	onMount(() => {
		downloads.init();
		return () => downloads.dispose();
	});

	function toggleSelecting() {
		selecting = !selecting;
		if (!selecting) downloads.clearSelection();
	}
	function toggleAll() {
		if (allSelected) downloads.clearSelection();
		else downloads.selectAll(downloads.queue.map((q) => q.id));
	}
	function confirmDelete() {
		downloads.removeSelected();
		confirmOpen = false;
		selecting = false;
	}
	function openGroup() {
		gName = '';
		gFolder = '';
		gChunks = 4;
		gAuto = false;
		gSchedule = '';
		groupOpen = true;
	}
	function saveGroup() {
		if (!canSave) return;
		downloads.addGroup({
			name: gName.trim(),
			folder: gFolder.trim(),
			chunks: gChunks,
			autoStart: gAuto,
			schedule: gSchedule.trim()
		});
		groupOpen = false;
	}
</script>

<div class="page">
	<div class="top">
		<h1 class="title">{t('downloads.title')}</h1>
		<SegmentedControl
			options={[
				{
					value: 'queue',
					label: `${t('downloads.queue')} (${digits(downloads.queue.length)})`,
					icon: 'download'
				},
				{ value: 'library', label: t('downloads.library'), icon: 'film' },
				{ value: 'groups', label: t('downloads.groups'), icon: 'folder' }
			]}
			bind:value={tab}
		/>
	</div>

	{#if tab === 'queue'}
		<div class="toolbar">
			<Button variant="secondary" size="sm" icon="pause" onclick={() => downloads.pauseAll()}>
				{t('downloads.pauseAll')}
			</Button>
			<Button variant="secondary" size="sm" icon="play" onclick={() => downloads.resumeAll()}>
				{t('downloads.resumeAll')}
			</Button>
			<span class="spacer"></span>
			{#if selecting}
				<Button variant="ghost" size="sm" onclick={toggleAll}>
					{allSelected ? t('common.clear') : t('common.selectAll')}
				</Button>
				<Button
					variant="danger"
					size="sm"
					icon="trash"
					disabled={downloads.selected.size === 0}
					onclick={() => (confirmOpen = true)}
				>
					{t('downloads.deleteSelected')}
					{#if downloads.selected.size > 0}({digits(downloads.selected.size)}){/if}
				</Button>
			{/if}
			<Button variant="outline" size="sm" icon="check" active={selecting} onclick={toggleSelecting}>
				{selecting ? t('common.cancel') : t('common.selected')}
			</Button>
		</div>

		{#if downloads.queue.length === 0}
			<EmptyState icon="download" title={t('downloads.empty')} />
		{:else}
			<div class="list">
				{#each downloads.queue as item, i (`${item.id}-${i}`)}
					<div class="stagger-in" style="--i:{Math.min(i, 12)}">
						<QueueRow {item} {selecting} />
					</div>
				{/each}
			</div>
		{/if}
	{:else if tab === 'library'}
		{#if downloads.library.length === 0}
			<EmptyState icon="film" title={t('downloads.libraryEmpty')} />
		{:else}
			<div class="list">
				{#each downloads.library as item, i (`${item.id}-${i}`)}
					<div class="stagger-in" style="--i:{Math.min(i, 12)}">
						<QueueRow {item} library />
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="toolbar">
			<span class="spacer"></span>
			<Button variant="primary" size="sm" icon="plus" onclick={openGroup}
				>{t('downloads.newGroup')}</Button
			>
		</div>
		<div class="groups">
			{#each downloads.groups as g, i (`${g.id}-${i}`)}
				<article class="gcard stagger-in" style="--i:{Math.min(i, 12)}">
					<h3 class="gname">{g.name}</h3>
					<p class="gline"><Icon name="folder" size={16} /><span class="latin">{g.folder}</span></p>
					<div class="gmeta">
						<Badge tone="gold">{t('downloads.chunks')}: {digits(g.chunks)}</Badge>
						{#if g.autoStart}<Badge tone="success">{t('downloads.autoStart')}</Badge>{/if}
						{#if g.schedule}
							<Badge tone="blue"><span class="latin">{g.schedule}</span></Badge>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={confirmOpen} title={t('downloads.deleteSelected')} width="420px">
	<p class="msg">{digits(downloads.selected.size)} {t('common.selected')}</p>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (confirmOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="danger" icon="trash" onclick={confirmDelete}>{t('common.confirm')}</Button>
	{/snippet}
</Modal>

<Modal bind:open={groupOpen} title={t('downloads.newGroup')}>
	<form
		class="form"
		onsubmit={(e) => {
			e.preventDefault();
			saveGroup();
		}}
	>
		<Field bind:value={gName} label={t('downloads.groups')} icon="folder" />
		<Field bind:value={gFolder} label={t('downloads.folder')} placeholder="~/Downloads/OskolKhan" />
		<div class="frow">
			<span class="flbl">{t('downloads.chunks')}</span>
			<SegmentedControl
				size="sm"
				options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))}
				bind:value={gChunks}
			/>
		</div>
		<div class="frow">
			<span class="flbl">{t('downloads.autoStart')}</span>
			<Toggle bind:checked={gAuto} />
		</div>
		<Field
			bind:value={gSchedule}
			label={t('downloads.schedule')}
			placeholder="HH:mm"
			icon="calendar"
		/>
	</form>
	{#snippet footer()}
		<Button variant="ghost" onclick={() => (groupOpen = false)}>{t('common.cancel')}</Button>
		<Button variant="primary" disabled={!canSave} onclick={saveGroup}>{t('common.save')}</Button>
	{/snippet}
</Modal>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
		flex-wrap: wrap;
	}
	.title {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}
	.spacer {
		flex: 1;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.groups {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--sp-4);
	}
	.gcard {
		border: 1px solid var(--border);
		background: var(--surface-1);
		border-radius: var(--r-lg);
		padding: var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		transition:
			border-color var(--dur) var(--ease),
			transform var(--dur) var(--ease);
	}
	.gcard:hover {
		border-color: var(--border-strong);
		transform: translateY(-2px);
	}
	.gname {
		font-weight: 800;
		font-size: 1.05rem;
	}
	.gline {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.gmeta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
	}
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.frow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-3);
	}
	.flbl {
		color: var(--text-muted);
		font-weight: 600;
	}
	.msg {
		color: var(--text-muted);
	}
</style>
