<script lang="ts">
	import { t } from '$lib/i18n';
	import { downloads, type DownloadItem } from '$lib/stores/downloads.svelte';
	import { digits, fileSize, speed } from '$lib/util/format';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';

	interface Props {
		item: DownloadItem;
		selecting?: boolean;
		library?: boolean;
	}
	let { item, selecting = false, library = false }: Props = $props();

	let checked = $derived(downloads.selected.has(item.id));
	let statusLabel = $derived(
		{
			downloading: t('downloads.downloading'),
			paused: t('downloads.paused'),
			queued: t('downloads.queued'),
			completed: t('downloads.completed')
		}[item.status]
	);
	let tone = $derived<'gold' | 'success' | 'neutral'>(
		item.status === 'downloading' ? 'gold' : item.status === 'completed' ? 'success' : 'neutral'
	);
</script>

<div class="row" class:checked>
	{#if selecting}
		<input
			type="checkbox"
			class="chk"
			{checked}
			onchange={() => downloads.toggleSelect(item.id)}
			aria-label={item.title}
		/>
	{/if}

	<div class="main">
		<div class="head">
			<div class="names">
				<p class="name">{item.title}</p>
				<p class="sub">{item.subtitle}</p>
			</div>
			<Badge tone="violet">{item.quality}</Badge>
			<Badge {tone}>{statusLabel}</Badge>
		</div>

		{#if !library}
			<div
				class="bar"
				role="progressbar"
				aria-valuenow={item.progress}
				aria-valuemin="0"
				aria-valuemax="100"
			>
				<div
					class="fill"
					class:live={item.status === 'downloading'}
					style:inline-size="{item.progress}%"
				></div>
			</div>
			<div class="meta">
				<span class="latin">{digits(Math.round(item.progress))}%</span>
				{#if item.status === 'downloading'}<span class="latin">{speed(item.speedKbps)}</span>{/if}
				<span class="latin">{fileSize(item.sizeMb)}</span>
			</div>
		{:else}
			<div class="meta"><span class="latin">{fileSize(item.sizeMb)}</span></div>
		{/if}
	</div>

	<div class="actions">
		{#if library}
			<Button variant="primary" size="sm" icon="play" href={`/player?id=${item.titleId}`}>
				{t('common.play')}
			</Button>
		{:else}
			<Button
				variant="secondary"
				size="icon"
				onclick={() => downloads.toggle(item.id)}
				title={item.status === 'downloading' ? t('downloads.pause') : t('downloads.resume')}
				icon={item.status === 'downloading' ? 'pause' : 'play'}
			/>
		{/if}
		<Button
			variant="ghost"
			size="icon"
			icon="trash"
			onclick={() => downloads.remove(item.id)}
			title={t('common.delete')}
		/>
	</div>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-4);
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		transition:
			border-color var(--dur) var(--ease),
			background var(--dur) var(--ease);
	}
	.row:hover {
		background: var(--surface-2);
	}
	.row.checked {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.chk {
		inline-size: 18px;
		block-size: 18px;
		accent-color: var(--accent);
		flex-shrink: 0;
	}
	.main {
		flex: 1;
		min-inline-size: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.names {
		flex: 1;
		min-inline-size: 0;
	}
	.name {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.bar {
		block-size: 6px;
		border-radius: 999px;
		background: var(--surface-3);
		overflow: hidden;
	}
	.fill {
		block-size: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent-strong), var(--accent));
		transition: inline-size 0.6s var(--ease);
	}
	.fill.live {
		box-shadow: 0 0 10px var(--accent-soft);
	}
	.meta {
		display: flex;
		gap: var(--sp-4);
		color: var(--text-dim);
		font-size: 0.8rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
</style>
