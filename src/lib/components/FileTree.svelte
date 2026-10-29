<script lang="ts">
	import { untrack } from 'svelte';
	import type { GroupInfoV2, FileV2 } from '$lib/api';
	import { t } from '$lib/i18n';
	import { digits, fileSize } from '$lib/util/format';
	import { groupBadges } from '$lib/util/enums';
	import Self from './FileTree.svelte';
	import Icon from './Icon.svelte';
	import Badge from './Badge.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		node: GroupInfoV2;
		level?: number;
		onplay: (file: FileV2, playlist: FileV2[], index: number) => void;
		ondownload: (file: FileV2) => void;
		oncopylink: (file: FileV2) => void;
	}
	let { node, level = 0, onplay, ondownload, oncopylink }: Props = $props();

	// `level` is constant per node instance; capture the initial open state once.
	let open = $state(untrack(() => level < 1));
	let badges = $derived(groupBadges(node));
	let heading = $derived(node.Title[0] ?? '');
	let subheading = $derived(node.Title[1] ?? '');
	let hasChildren = $derived(node.Child.length > 0);
	let hasFiles = $derived(node.Files.length > 0);
</script>

<div class="node" class:root={level === 0} style="--lvl:{level}">
	{#if heading}
		<button class="row head" onclick={() => (open = !open)} aria-expanded={open}>
			<span class="chev" class:open><Icon name="chevron-left" size={18} /></span>
			<span class="titles">
				<b>{heading}</b>
				{#if subheading}<small class="latin">{subheading}</small>{/if}
			</span>
			<span class="badges">
				{#each badges as b (b.label)}<Badge tone={b.tone}>{b.label}</Badge>{/each}
			</span>
			{#if node.FilesCount > 0}
				<span class="count">{digits(node.FilesCount)}</span>
			{/if}
		</button>
	{/if}

	{#if open}
		<div class="children">
			{#if hasChildren}
				{#each node.Child as child (child.id)}
					<Self node={child} level={level + 1} {onplay} {ondownload} {oncopylink} />
				{/each}
			{/if}
			{#if hasFiles}
				<ul class="files">
					{#each node.Files as file, i (`${file.id}-${i}`)}
						<li class="file">
							<span class="finfo">
								<span class="fname">{file.Title[0] ?? file.description ?? t('common.episode')}</span
								>
								{#if file.ExtraInfo.length}
									<span class="extra">{file.ExtraInfo.join(' · ')}</span>
								{/if}
							</span>
							{#if file.Size > 0}<span class="size latin">{fileSize(file.Size)}</span>{/if}
							<span class="facts">
								{#if file.isDub}<Badge tone="red">دوبله</Badge>{/if}
								{#if file.SoftSub}<Badge tone="neutral">Sub</Badge>{/if}
							</span>
							<span class="actions">
								<IconButton
									icon="play-filled"
									size="sm"
									variant="surface"
									label={t('common.play')}
									onclick={() => onplay(file, node.Files, i)}
								/>
								<IconButton
									icon="external"
									size="sm"
									variant="ghost"
									label={t('item.copyLink')}
									onclick={() => oncopylink(file)}
								/>
								{#if file.Download}
									<IconButton
										icon="download"
										size="sm"
										variant="ghost"
										label={t('common.download')}
										onclick={() => ondownload(file)}
									/>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.node {
		border-radius: var(--r-md);
	}
	.root {
		border: none;
	}
	.head {
		inline-size: 100%;
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding-inline: var(--sp-3);
		padding-block: var(--sp-3);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		color: var(--text);
		text-align: start;
		margin-block-start: var(--sp-2);
		transition: background var(--dur-fast) var(--ease);
	}
	.head:hover {
		background: var(--surface-hover);
	}
	.titles {
		display: flex;
		align-items: baseline;
		gap: var(--sp-2);
		flex: 1;
		min-inline-size: 0;
	}
	.titles b {
		font-size: 0.95rem;
	}
	.titles small {
		color: var(--text-dim);
		font-size: 0.78rem;
	}
	.badges {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}
	.count {
		font-family: var(--font-latin);
		font-size: 0.72rem;
		color: var(--text-muted);
		background: var(--surface-3);
		padding-inline: 8px;
		padding-block: 2px;
		border-radius: var(--r-full);
	}
	.children {
		padding-inline-start: calc(var(--sp-3) * var(--lvl));
	}
	.files {
		list-style: none;
		padding: 0;
		margin-block-start: var(--sp-2);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.file {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding-inline: var(--sp-3);
		padding-block: var(--sp-2);
		border-radius: var(--r-sm);
		background: var(--surface-1);
		border: 1px solid transparent;
		transition: all var(--dur-fast) var(--ease);
	}
	.file:hover {
		border-color: var(--border);
		background: var(--surface-2);
	}
	.finfo {
		flex: 1;
		min-inline-size: 0;
		display: flex;
		flex-direction: column;
	}
	.fname {
		font-size: 0.88rem;
		font-weight: 500;
	}
	.extra {
		font-size: 0.74rem;
		color: var(--text-dim);
	}
	.size {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.facts {
		display: flex;
		gap: 4px;
	}
	.actions {
		display: flex;
		gap: var(--sp-2);
	}
	.head:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.chev {
		display: inline-grid;
		transition: transform var(--dur) var(--ease-out);
	}
	.chev.open {
		transform: rotate(-90deg);
	}
	.children {
		animation: slide-in var(--dur) var(--ease-out) both;
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
	}
</style>
