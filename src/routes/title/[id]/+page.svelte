<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import type { GenericTitle, ItemDetail, TitleFilesV2, GroupInfoV2, FileV2 } from '$lib/api';
	import { t } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { player } from '$lib/stores/player.svelte';
	import { downloads } from '$lib/stores/downloads.svelte';
	import { backdrop, poster, placeholderGradient } from '$lib/util/images';
	import { year, rankText, runtime, compact } from '$lib/util/format';
	import { titleQualityBadges } from '$lib/util/enums';
	import Poster from '$lib/components/Poster.svelte';
	import Button from '$lib/components/Button.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import RatingChip from '$lib/components/RatingChip.svelte';
	import PersonCard from '$lib/components/PersonCard.svelte';
	import FileTree from '$lib/components/FileTree.svelte';
	import Skeleton from '$lib/components/Skeleton.svelte';
	import ErrorState from '$lib/components/ErrorState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	let id = $derived(Number(page.params.id));

	let title = $state<GenericTitle | null>(null);
	let detail = $state<ItemDetail | null>(null);
	let files = $state<TitleFilesV2 | null>(null);
	let loading = $state(true);
	let failed = $state(false);
	let expanded = $state(false);
	let liked = $state(false);
	let popping = $state(false);

	async function load(targetId: number) {
		loading = true;
		failed = false;
		title = null;
		detail = null;
		files = null;
		try {
			const [ti, de, fi] = await Promise.all([
				api.item(targetId),
				api.itemDetail(targetId),
				api.files(targetId)
			]);
			title = ti;
			detail = de;
			files = fi;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		const current = id;
		if (!Number.isNaN(current)) load(current);
	});

	let name = $derived(
		title ? (ui.titleLang === 'original' ? title.titles[0] || title.persian : title.persian) : ''
	);
	let altName = $derived(title ? title.orgtitles[0] || title.titles[0] || '' : '');
	let genres = $derived(title ? preload.genres(title.genres) : []);
	let countryName = $derived(detail ? preload.country(detail.country) : '');
	let cast = $derived(
		detail ? [...detail.director, ...detail.creator, ...detail.people].slice(0, 12) : []
	);
	let badges = $derived(title ? titleQualityBadges(title) : []);

	function firstPlayable(node: GroupInfoV2 | null): { file: FileV2; list: FileV2[] } | null {
		if (!node) return null;
		if (node.Files.length) return { file: node.Files[0], list: node.Files };
		for (const c of node.Child) {
			const r = firstPlayable(c);
			if (r) return r;
		}
		return null;
	}

	function playFile(file: FileV2, list: FileV2[], index: number) {
		if (!title) return;
		player.open({ title, file, playlist: list, index });
		goto(`/player?id=${id}`);
	}

	function playDefault() {
		const p = firstPlayable(files?.Items ?? null);
		if (p) playFile(p.file, p.list, 0);
		else goto(`/player?id=${id}`);
	}

	function download(file: FileV2) {
		downloads.addFromTitle(id, title?.Q || 'HD', file.Title[0] ?? file.description ?? '');
	}

	async function copyLink(file: FileV2) {
		try {
			const { url } = await api.playUrl({ urn: file.urn, id: file.id });
			await navigator.clipboard?.writeText(url);
			toast.success(t('item.linkCopied'), url);
		} catch (e) {
			toast.info(t('item.linkFailed'), e instanceof Error ? e.message : String(e));
		}
	}

	async function toggleLike() {
		if (!title) return;
		liked = !liked;
		if (liked) {
			popping = false;
			requestAnimationFrame(() => (popping = true));
			toast.success(t('common.liked'));
		}
		try {
			await api.like({ category: title.contenttype, item: id, on: liked, status: 1 });
		} catch {
			liked = !liked;
		}
	}

	function share() {
		const url = `oskolkhan://title/${id}`;
		try {
			navigator.clipboard?.writeText(url);
		} catch {
			/* ignore */
		}
	}
</script>

{#if loading}
	<div class="page">
		<Skeleton height="420px" radius="var(--r-xl)" />
		<div class="skgrid">
			<Skeleton height="2rem" width="60%" />
			<Skeleton height="1rem" width="40%" />
			<Skeleton height="6rem" />
		</div>
	</div>
{:else if failed || !title}
	<div class="page"><ErrorState onretry={() => load(id)} /></div>
{:else}
	<article>
		<header class="hero">
			{#key title.id}
				<div
					class="bg"
					style="background-image:{title.img
						? `url(${backdrop(title.img)}), ${placeholderGradient(title.id)}`
						: placeholderGradient(title.id)}"
				></div>
			{/key}
			<div class="veil"></div>
			<div class="herobody">
				<div class="posterwrap">
					<Poster src={poster(title.img, 300)} alt={name} seed={title.id} label={name} />
				</div>
				<div class="headmeta">
					<h1>{name}</h1>
					{#if altName && altName !== name}<p class="alt latin">{altName}</p>{/if}
					<div class="facts latin">
						{#if title.rank > 0}
							<span class="rank"><Icon name="star-filled" size={15} />{rankText(title.rank)}</span>
						{/if}
						{#if title.Year}<span>{year(title.Year)}</span>{/if}
						{#if detail && detail.runtime}<span>{runtime(detail.runtime)}</span>{/if}
						{#if title.votes}<span>{compact(title.votes)}</span>{/if}
						{#if countryName}<span class="fa">{countryName}</span>{/if}
					</div>
					{#if genres.length}
						<div class="genres">
							{#each genres as g (g)}<span class="genre">{g}</span>{/each}
						</div>
					{/if}
					{#if badges.length}
						<div class="qbadges">
							{#each badges as b (b.label)}<Badge tone={b.tone}>{b.label}</Badge>{/each}
							{#if title.MustSee}<Badge tone="gold">{t('title.mustSee')}</Badge>{/if}
						</div>
					{/if}
					<div class="actions">
						<Button variant="primary" size="lg" icon="play-filled" onclick={playDefault}>
							{t('common.play')}
						</Button>
						<Button variant="secondary" icon="download" onclick={playDefault}>
							{t('common.download')}
						</Button>
						<span class="likewrap" class:pop={popping} onanimationend={() => (popping = false)}>
							<IconButton
								variant="surface"
								icon={liked ? 'heart-filled' : 'heart'}
								active={liked}
								toggle
								label={t('common.like')}
								onclick={toggleLike}
							/>
						</span>
						<IconButton variant="surface" icon="share" label={t('common.share')} onclick={share} />
						<IconButton
							variant="surface"
							icon="external"
							label={t('common.openExternal')}
							onclick={playDefault}
						/>
					</div>
				</div>
			</div>
		</header>

		<div class="page body">
			<div class="col main">
				{#if detail && detail.rating.length}
					<section class="ratings">
						{#each detail.rating as r (r.type)}
							{#if r.r1}<RatingChip rating={r} />{/if}
						{/each}
					</section>
				{/if}

				{#if title.Description}
					<section>
						<h2 class="section-title">{t('title.synopsis')}</h2>
						<p class="synopsis" class:clamped={!expanded}>{title.Description}</p>
						{#if title.Description.length > 180}
							<button class="link" onclick={() => (expanded = !expanded)}>
								{expanded ? t('title.readLess') : t('title.readMore')}
							</button>
						{/if}
					</section>
				{/if}

				{#if files?.Items}
					<section>
						<h2 class="section-title">{t('title.files')}</h2>
						<div class="tree">
							<FileTree
								node={files.Items}
								onplay={playFile}
								ondownload={download}
								oncopylink={copyLink}
							/>
						</div>
					</section>
				{/if}

				{#if cast.length}
					<section>
						<h2 class="section-title">{t('title.cast')}</h2>
						<div class="castgrid">
							{#each cast as c, i (c.id + c.title2)}
								<div class="stagger-in" style="--i:{Math.min(i, 12)}"><PersonCard item={c} /></div>
							{/each}
						</div>
					</section>
				{/if}
			</div>

			<aside class="col side">
				{#if detail}
					<div class="infocard">
						{#if detail.network.length}
							<div class="inforow">
								<span class="k">{t('title.network')}</span>
								<span class="v">{detail.network.map((n) => n.title1).join('، ')}</span>
							</div>
						{/if}
						{#if countryName}
							<div class="inforow">
								<span class="k">{t('title.country')}</span><span class="v">{countryName}</span>
							</div>
						{/if}
						{#if detail.runtime}
							<div class="inforow">
								<span class="k">{t('title.runtime')}</span>
								<span class="v">{runtime(detail.runtime)}</span>
							</div>
						{/if}
						{#if detail.Budget > 0}
							<div class="inforow">
								<span class="k">{t('title.budget')}</span>
								<span class="v latin">${compact(detail.Budget)}</span>
							</div>
						{/if}
						{#if detail.Revenue > 0}
							<div class="inforow">
								<span class="k">{t('title.revenue')}</span>
								<span class="v latin">${compact(detail.Revenue)}</span>
							</div>
						{/if}
					</div>
				{/if}

				{#if detail && detail.recommended.length}
					<div class="recs">
						<h3 class="section-title">{t('title.recommendations')}</h3>
						<div class="recgrid">
							{#each detail.recommended as r, i (`${r.id}-${i}`)}
								<a class="rec stagger-in" style="--i:{Math.min(i, 12)}" href={`/title/${r.id}`}>
									<Poster src={poster(r.img)} alt={r.title1} seed={r.id} label={r.title1} />
									<span class="recname">{r.title1}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</aside>
		</div>
	</article>
{/if}

<style>
	.hero {
		position: relative;
		min-block-size: 420px;
		display: flex;
		align-items: flex-end;
		isolation: isolate;
	}
	.bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center 20%;
	}
	.veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			var(--bg),
			color-mix(in srgb, var(--bg) 35%, transparent) 55%,
			transparent
		);
	}
	.herobody {
		position: relative;
		display: flex;
		gap: var(--sp-6);
		align-items: flex-end;
		padding-inline: clamp(var(--sp-4), 4vw, var(--sp-7));
		padding-block-end: var(--sp-6);
		inline-size: 100%;
	}
	.posterwrap {
		inline-size: 190px;
		flex: none;
		border-radius: var(--r-lg);
		overflow: hidden;
		box-shadow: var(--shadow-lg);
	}
	.headmeta {
		flex: 1;
		min-inline-size: 0;
		padding-block-end: var(--sp-2);
	}
	.headmeta h1 {
		font-size: clamp(1.8rem, 3.4vw, 2.8rem);
		line-height: 1.08;
	}
	.alt {
		color: var(--text-muted);
		margin-block-start: 4px;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-4);
		margin-block-start: var(--sp-3);
		color: var(--text-muted);
		font-weight: 600;
	}
	.facts .fa {
		font-family: var(--font-fa);
	}
	.rank {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--accent);
	}
	.genres {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-2);
		margin-block-start: var(--sp-3);
	}
	.genre {
		font-size: 0.82rem;
		color: var(--text-muted);
		background: var(--surface-2);
		border: 1px solid var(--border);
		padding-inline: var(--sp-3);
		padding-block: 4px;
		border-radius: var(--r-full);
	}
	.qbadges {
		display: flex;
		gap: var(--sp-2);
		margin-block-start: var(--sp-3);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		margin-block-start: var(--sp-5);
	}
	.body {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: var(--sp-6);
		align-items: start;
	}
	.col {
		min-inline-size: 0;
	}
	section {
		margin-block-end: var(--sp-6);
	}
	.ratings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
	}
	.section-title {
		margin-block-end: var(--sp-4);
	}
	.synopsis {
		color: var(--text);
		opacity: 0.9;
		line-height: 1.85;
	}
	.synopsis.clamped {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent);
		font-weight: 600;
		margin-block-start: var(--sp-2);
		padding: 0;
		cursor: pointer;
		border-radius: var(--r-sm);
		transition: color var(--dur-fast) var(--ease);
	}
	.link:hover {
		color: var(--accent-strong);
	}
	.link:focus-visible,
	.rec:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}
	.likewrap {
		display: inline-flex;
	}
	.likewrap.pop :global(svg) {
		animation: heart-pop 420ms var(--ease-spring) both;
	}
	@keyframes heart-pop {
		0% {
			transform: scale(1);
		}
		35% {
			transform: scale(1.5) rotate(-8deg);
		}
		70% {
			transform: scale(0.92);
		}
		100% {
			transform: scale(1);
		}
	}
	.castgrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: var(--sp-4);
	}
	.infocard {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: var(--sp-4);
	}
	.inforow {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-3);
		padding-block: var(--sp-2);
		border-block-end: 1px solid var(--border);
	}
	.inforow:last-child {
		border-block-end: none;
	}
	.inforow .k {
		color: var(--text-dim);
		font-size: 0.85rem;
	}
	.inforow .v {
		font-weight: 600;
		font-size: 0.88rem;
		text-align: end;
	}
	.recs {
		margin-block-start: var(--sp-5);
	}
	.recgrid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--sp-3);
	}
	.rec {
		display: block;
		border-radius: var(--r-md);
		transition: transform var(--dur-fast) var(--ease);
	}
	.rec:hover {
		transform: translateY(-3px);
	}
	.rec:hover .recname {
		color: var(--text);
	}
	.recname {
		display: block;
		font-size: 0.74rem;
		margin-block-start: var(--sp-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-muted);
	}
	.skgrid {
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		margin-block-start: var(--sp-5);
	}
	@media (max-width: 1000px) {
		.body {
			grid-template-columns: 1fr;
		}
	}
</style>
