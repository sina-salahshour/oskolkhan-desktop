<script lang="ts">
	import { t, i18n } from '$lib/i18n';
	import { ui } from '$lib/stores/ui.svelte';
	import type { ViewMode } from '$lib/stores/ui.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { digits } from '$lib/util/format';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import Slider from '$lib/components/Slider.svelte';

	const CACHE_KEY = 'oskol:cache';
	const DEVICE_ID = 'a1b2c3d4e5f6';
	const FALLBACK_UA =
		'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

	let userAgent = $derived(preload.data?.Envs || FALLBACK_UA);
	let cleared = $state(false);
	let clearTimer: ReturnType<typeof setTimeout> | undefined;

	const viewOptions: { value: ViewMode; icon: 'grid' | 'list' | 'film' }[] = [
		{ value: 'grid', icon: 'grid' },
		{ value: 'list', icon: 'list' },
		{ value: 'poster', icon: 'film' }
	];
	const fonts = ['Vazirmatn', 'Estedad', 'Inter'].map((f) => ({ value: f, label: f }));

	function setMovieView(v: ViewMode) {
		ui.movieView = v;
		ui.persist();
	}
	function setSeriesView(v: ViewMode) {
		ui.seriesView = v;
		ui.persist();
	}
	function clearCache() {
		try {
			localStorage.removeItem(CACHE_KEY);
		} catch {
			/* ignore */
		}
		cleared = true;
		clearTimeout(clearTimer);
		clearTimer = setTimeout(() => (cleared = false), 2600);
	}

	let previewShadow = $derived(
		{
			none: 'none',
			outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
			drop: '2px 2px 4px rgba(0,0,0,.9)',
			raised: '0 -1px 0 rgba(255,255,255,.55), 0 2px 2px rgba(0,0,0,.8)'
		}[ui.subtitle.edge]
	);
</script>

<div class="page">
	<h1 class="title">{t('settings.title')}</h1>

	<section class="card stagger-in" style="--i:0">
		<h2 class="section-title">{t('settings.appearance')}</h2>
		<div class="row">
			<span class="lbl">{t('settings.theme')}</span>
			<SegmentedControl
				options={[
					{ value: 'dark', label: t('settings.themeDark'), icon: 'moon' },
					{ value: 'light', label: t('settings.themeLight'), icon: 'sun' }
				]}
				value={ui.theme}
				onchange={(v) => ui.setTheme(v)}
			/>
		</div>
		<div class="row">
			<span class="lbl">{t('settings.language')}</span>
			<SegmentedControl
				options={[
					{ value: 'fa', label: 'فارسی', icon: 'globe' },
					{ value: 'en', label: 'English', icon: 'globe' }
				]}
				value={i18n.lang}
				onchange={(v) => i18n.setLang(v)}
			/>
		</div>
		<div class="row">
			<span class="lbl">{t('settings.titleLanguage')}</span>
			<SegmentedControl
				options={[
					{ value: 'persian', label: t('settings.titlePersian') },
					{ value: 'original', label: t('settings.titleOriginal') }
				]}
				value={ui.titleLang}
				onchange={(v) => {
					ui.titleLang = v;
					ui.persist();
				}}
			/>
		</div>
	</section>

	<section class="card stagger-in" style="--i:1">
		<h2 class="section-title">{t('settings.playback')}</h2>
		<div class="row">
			<span class="lbl">{t('settings.movieView')}</span>
			<SegmentedControl options={viewOptions} value={ui.movieView} onchange={setMovieView} />
		</div>
		<div class="row">
			<span class="lbl">{t('settings.seriesView')}</span>
			<SegmentedControl options={viewOptions} value={ui.seriesView} onchange={setSeriesView} />
		</div>
		<div class="row">
			<span class="lbl">{t('settings.bufferProfile')}</span>
			<SegmentedControl
				options={[
					{ value: 'low', label: t('settings.bufferLow') },
					{ value: 'balanced', label: t('settings.bufferBalanced') },
					{ value: 'high', label: t('settings.bufferHigh') }
				]}
				value={ui.buffer}
				onchange={(v) => {
					ui.buffer = v;
					ui.persist();
				}}
			/>
		</div>
	</section>

	<section class="card stagger-in" style="--i:2">
		<h2 class="section-title">{t('settings.subtitleDefaults')}</h2>
		<div class="preview-wrap">
			<div class="preview" aria-hidden="true">
				<span
					class="sample"
					style:font-family="{ui.subtitle.font}, sans-serif"
					style:font-size="{(ui.subtitle.size / 100) * 1.25}rem"
					style:color={ui.subtitle.color}
					style:text-shadow={previewShadow}
					style:background="rgba(0,0,0,{ui.subtitle.background / 100})"
					style:inset-block-end="{ui.subtitle.position * 0.7 + 6}%"
				>
					این یک زیرنویس نمونه است · Sample subtitle
				</span>
			</div>
		</div>
		<div class="row">
			<span class="lbl">{t('player.font')}</span>
			<SegmentedControl
				options={fonts}
				value={ui.subtitle.font}
				onchange={(v) => {
					ui.subtitle.font = v;
					ui.persist();
				}}
			/>
		</div>
		<div class="row stack">
			<Slider
				min={50}
				max={200}
				step={5}
				bind:value={ui.subtitle.size}
				label={t('player.fontSize')}
				valueText={`${digits(ui.subtitle.size)}%`}
				onchange={() => ui.persist()}
			/>
		</div>
		<div class="row stack">
			<Slider
				min={0}
				max={100}
				bind:value={ui.subtitle.position}
				label={t('player.position')}
				valueText={digits(ui.subtitle.position)}
				onchange={() => ui.persist()}
			/>
		</div>
		<div class="row">
			<span class="lbl">{t('player.edge')}</span>
			<SegmentedControl
				size="sm"
				options={[
					{ value: 'none', label: 'None' },
					{ value: 'outline', label: 'Outline' },
					{ value: 'drop', label: 'Drop' },
					{ value: 'raised', label: 'Raised' }
				]}
				value={ui.subtitle.edge}
				onchange={(v) => {
					ui.subtitle.edge = v;
					ui.persist();
				}}
			/>
		</div>
		<div class="row stack">
			<Slider
				min={0}
				max={100}
				bind:value={ui.subtitle.background}
				label={t('player.background')}
				valueText={`${digits(ui.subtitle.background)}%`}
				onchange={() => ui.persist()}
			/>
		</div>
	</section>

	<section class="card stagger-in" style="--i:3">
		<h2 class="section-title">{t('settings.storage')}</h2>
		<div class="row">
			<span class="lbl">{t('settings.clearCache')}</span>
			<div class="act">
				{#if cleared}
					<span class="ok" role="status"
						><Icon name="check" size={16} />{t('settings.cacheCleared')}</span
					>
				{/if}
				<Button variant="outline" icon="trash" onclick={clearCache}
					>{t('settings.clearCache')}</Button
				>
			</div>
		</div>
	</section>

	<section class="card stagger-in" style="--i:4">
		<h2 class="section-title">{t('settings.device')}</h2>
		<div class="row">
			<span class="lbl">{t('settings.deviceId')}</span>
			<code class="mono latin">{DEVICE_ID}</code>
		</div>
		<div class="row stack">
			<span class="lbl">{t('settings.userAgent')}</span>
			<code class="mono latin ua">{userAgent}</code>
		</div>
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		max-inline-size: 820px;
	}
	.title {
		font-size: 1.6rem;
		font-weight: 800;
	}
	.card {
		border: 1px solid var(--border);
		background: var(--surface-1);
		border-radius: var(--r-lg);
		padding: var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
		flex-wrap: wrap;
		padding-block-start: var(--sp-4);
		border-block-start: 1px solid var(--border);
	}
	.row.stack {
		flex-direction: column;
		align-items: stretch;
	}
	.lbl {
		color: var(--text-muted);
		font-weight: 600;
	}
	.act {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.ok {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--success);
		background: var(--success-soft);
		padding: var(--sp-2) var(--sp-3);
		border-radius: var(--r-md);
		font-size: 0.85rem;
		animation: pop var(--dur) var(--ease);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	.preview-wrap {
		padding-block-end: var(--sp-1);
	}
	.preview {
		position: relative;
		block-size: 150px;
		border-radius: var(--r-md);
		overflow: hidden;
		border: 1px solid var(--border);
		background:
			radial-gradient(circle at 70% 30%, #3a2f1a 0%, transparent 55%),
			linear-gradient(135deg, #14161c, #0a0b0f);
	}
	.sample {
		position: absolute;
		inset-inline: 0;
		margin-inline: auto;
		inline-size: fit-content;
		padding: 2px 10px;
		border-radius: 4px;
		white-space: nowrap;
		max-inline-size: 92%;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: all var(--dur) var(--ease);
	}
	.mono {
		font-family: ui-monospace, 'JetBrains Mono', monospace;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: var(--sp-2) var(--sp-3);
		color: var(--text);
		direction: ltr;
		user-select: all;
	}
	.ua {
		font-size: 0.78rem;
		line-height: 1.5;
		word-break: break-all;
		color: var(--text-muted);
	}
</style>
