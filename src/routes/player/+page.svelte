<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import type { FileV2, GroupInfoV2 } from '$lib/api';
	import { t } from '$lib/i18n';
	import { player, SPEEDS } from '$lib/stores/player.svelte';
	import { timecode, digits } from '$lib/util/format';
	import Seekbar from '$lib/components/player/Seekbar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';

	let stage = $state<HTMLDivElement | null>(null);
	let controlsVisible = $state(true);
	// Melt owns each menu's open/close/Esc/outside-click; we only track whether
	// any is open so the auto-hide timer keeps the control bar alive.
	let speedOpen = $state(false);
	let audioOpen = $state(false);
	let subsOpen = $state(false);
	let anyMenuOpen = $derived(speedOpen || audioOpen || subsOpen);
	let panel = $state<'style' | 'sync' | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let held = false;
	let loadError = $state(false);

	function firstPlayable(node: GroupInfoV2 | null): { file: FileV2; list: FileV2[] } | null {
		if (!node) return null;
		if (node.Files.length) return { file: node.Files[0], list: node.Files };
		for (const c of node.Child) {
			const r = firstPlayable(c);
			if (r) return r;
		}
		return null;
	}

	onMount(() => {
		(async () => {
			if (!player.request.file) {
				const id = Number(page.url.searchParams.get('id'));
				if (Number.isNaN(id)) {
					loadError = true;
					return;
				}
				try {
					const [title, files] = await Promise.all([api.item(id), api.files(id)]);
					const p = firstPlayable(files.Items);
					if (!p) {
						loadError = true;
						return;
					}
					await player.open({ title, file: p.file, playlist: p.list, index: 0 });
				} catch {
					loadError = true;
					return;
				}
			}
			player.play();
		})();
		return () => player.dispose();
	});

	function showControls() {
		controlsVisible = true;
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			if (player.status === 'playing' && !anyMenuOpen && !panel) controlsVisible = false;
		}, 3000);
	}

	function onStageDown() {
		held = false;
		holdTimer = setTimeout(() => {
			held = true;
			player.setHoldFast(true);
		}, 220);
	}
	function onStageUp() {
		if (holdTimer) clearTimeout(holdTimer);
		if (held) {
			player.setHoldFast(false);
			held = false;
		} else {
			player.togglePlay();
		}
	}

	function onkeydown(e: KeyboardEvent) {
		// Don't hijack keys while a text input or a Melt slider has focus.
		if (
			e.target instanceof HTMLElement &&
			(e.target.tagName === 'INPUT' || e.target.closest('[role="slider"],[data-melt-slider-root]'))
		)
			return;
		switch (e.key) {
			case ' ':
			case 'k':
				e.preventDefault();
				player.togglePlay();
				break;
			case 'ArrowRight':
				player.seekBy(10);
				break;
			case 'ArrowLeft':
				player.seekBy(-10);
				break;
			case 'ArrowUp':
				player.setVolume(player.volume + 0.1);
				break;
			case 'ArrowDown':
				player.setVolume(player.volume - 0.1);
				break;
			case 'm':
				player.toggleMute();
				break;
			case 'f':
				toggleFullscreen();
				break;
			case 'Escape':
				// Melt closes any open menu itself; we only close the drawer.
				if (panel) panel = null;
				break;
		}
		showControls();
	}

	function toggleFullscreen() {
		if (!document.fullscreenElement) {
			stage?.requestFullscreen?.().catch(() => {});
			player.fullscreen = true;
		} else {
			document.exitFullscreen?.().catch(() => {});
			player.fullscreen = false;
		}
	}

	function togglePanel(which: 'style' | 'sync') {
		panel = panel === which ? null : which;
	}

	let name = $derived(player.request.title?.persian ?? '');
	let epLabel = $derived(
		player.request.file?.E ? `${t('common.episode')} ${digits(player.request.file.E)}` : ''
	);

	const EDGE_OPTIONS: { value: 'none' | 'outline' | 'drop' | 'raised'; label: string }[] = [
		{ value: 'none', label: 'None' },
		{ value: 'outline', label: 'Outline' },
		{ value: 'drop', label: 'Drop' },
		{ value: 'raised', label: 'Raised' }
	];
	const FONT_OPTIONS = [
		{ value: 'Vazirmatn', label: 'Vazirmatn' },
		{ value: 'Estedad', label: 'Estedad' },
		{ value: 'Inter', label: 'Inter' }
	];

	let subEdge = $derived.by(() => {
		switch (player.subtitleStyle.edge) {
			case 'outline':
				return '0 0 2px #000, 0 0 2px #000, 1px 1px 2px #000';
			case 'drop':
				return '2px 2px 4px rgba(0,0,0,0.9)';
			case 'raised':
				return '1px 1px 0 rgba(255,255,255,0.4), -1px -1px 2px rgba(0,0,0,0.9)';
			default:
				return 'none';
		}
	});
</script>

<svelte:window {onkeydown} />

<div
	class="player"
	class:idle={!controlsVisible}
	bind:this={stage}
	role="application"
	aria-label={name}
	onmousemove={showControls}
>
	<!-- stub video surface (phase 2 drops real playback behind PlaybackSource) -->
	<button
		class="stage"
		aria-label={t('common.play')}
		onpointerdown={onStageDown}
		onpointerup={onStageUp}
	>
		<div class="stub" style="background:radial-gradient(120% 90% at 50% 40%, #16161c, #050506)">
			{#if player.status === 'loading'}
				<div class="loading"><span class="ring"></span></div>
			{:else if player.status !== 'playing'}
				<div class="bigplay" transition:fade={{ duration: 120 }}>
					<Icon name="play-filled" size={38} />
				</div>
			{/if}
			{#if player.holdingFast}
				<div class="fast latin" transition:fade={{ duration: 100 }}>2× ▶▶</div>
			{/if}
		</div>

		<!-- subtitle preview -->
		{#if player.subtitleTrackId}
			<div class="subtrack" style="inset-block-end:{player.subtitleStyle.position}%">
				<span
					class="subline"
					style="
						font-family:'{player.subtitleStyle.font} Variable', var(--font-fa);
						font-size:{(player.subtitleStyle.size / 100) * 1.8}rem;
						color:{player.subtitleStyle.color};
						text-shadow:{subEdge};
						background:rgba(0,0,0,{player.subtitleStyle.background / 100});"
				>
					نمونه‌ی نمایش زیرنویس — subtitle preview
				</span>
			</div>
		{/if}
	</button>

	<!-- top bar -->
	{#if controlsVisible}
		<div class="top" transition:fly={{ y: -16, duration: 200 }}>
			<Tooltip content={t('common.back')}>
				<button class="ctl" aria-label={t('common.back')} onclick={() => goto('/')}>
					<Icon name="chevron-right" size={22} />
				</button>
			</Tooltip>
			<div class="titlebox">
				<b>{name}</b>
				{#if epLabel}<small>{epLabel}</small>{/if}
			</div>
			<span class="src-note">{t('player.playbackPhase2')}</span>
		</div>
	{/if}

	<!-- next-episode countdown -->
	{#if player.nextCountdown != null}
		<div class="next" transition:fly={{ y: 20, duration: 220 }}>
			<p>{t('player.nextIn', { n: player.nextCountdown })}</p>
			<div class="nextbtns">
				<Button variant="primary" size="sm" icon="skip-next" onclick={() => player.playNext()}>
					{t('player.playNow')}
				</Button>
				<Button variant="ghost" size="sm" onclick={() => player.cancelNextCountdown()}>
					{t('player.cancel')}
				</Button>
			</div>
		</div>
	{/if}

	<!-- control bar -->
	{#if controlsVisible}
		<div class="bar" transition:fly={{ y: 24, duration: 220 }}>
			<Seekbar
				currentTime={player.currentTime}
				duration={player.duration}
				buffered={player.buffered}
				onseek={(s) => player.seek(s)}
			/>

			<div class="row">
				<div class="left">
					<Tooltip content={t('common.play')}>
						<button class="ctl" aria-label={t('common.play')} onclick={() => player.togglePlay()}>
							<Icon name={player.status === 'playing' ? 'pause' : 'play-filled'} size={24} />
						</button>
					</Tooltip>
					<Tooltip content="−10s">
						<button class="ctl" aria-label="-10s" onclick={() => player.seekBy(-10)}>
							<Icon name="rewind" size={20} />
						</button>
					</Tooltip>
					<Tooltip content="+10s">
						<button class="ctl" aria-label="+10s" onclick={() => player.seekBy(10)}>
							<Icon name="forward" size={20} />
						</button>
					</Tooltip>
					{#if player.hasNext}
						<Tooltip content={t('player.nextEpisode')}>
							<button
								class="ctl"
								aria-label={t('player.nextEpisode')}
								onclick={() => player.playNext()}
							>
								<Icon name="skip-next" size={20} />
							</button>
						</Tooltip>
					{/if}
					<div class="vol">
						<Tooltip content={t('player.audio')}>
							<button
								class="ctl"
								aria-label={t('player.audio')}
								onclick={() => player.toggleMute()}
							>
								<Icon
									name={player.muted || player.volume === 0 ? 'volume-mute' : 'volume'}
									size={20}
								/>
							</button>
						</Tooltip>
						<div class="volwrap">
							<Slider
								min={0}
								max={1}
								step={0.05}
								value={player.muted ? 0 : player.volume}
								ariaLabel={t('player.audio')}
								onchange={(v) => player.setVolume(v)}
							/>
						</div>
					</div>
					<span class="time latin">
						{timecode(player.currentTime)} / {timecode(player.duration)}
					</span>
				</div>

				<div class="right">
					<!-- speed -->
					<Menu placement="top" align="end" bind:open={speedOpen}>
						{#snippet trigger(attrs, open)}
							<button {...attrs} class="ctl txt" class:active={open} aria-label={t('player.speed')}>
								<Icon name="gauge" size={19} /><span class="latin">{player.rate}×</span>
							</button>
						{/snippet}
						{#snippet children(close)}
							<p class="menuhint">{t('player.holdFor2x')}</p>
							{#each SPEEDS as s (s)}
								<button
									class="mitem"
									class:on={player.rate === s}
									onclick={() => {
										player.setRate(s);
										close();
									}}
								>
									<span class="latin">{s}×</span>
									{#if player.rate === s}<Icon name="check" size={16} />{/if}
								</button>
							{/each}
						{/snippet}
					</Menu>

					<!-- audio tracks -->
					<Menu placement="top" align="end" bind:open={audioOpen}>
						{#snippet trigger(attrs, open)}
							<button
								{...attrs}
								class="ctl"
								class:active={open}
								aria-label={t('player.audioTrack')}
							>
								<Icon name="volume" size={19} />
							</button>
						{/snippet}
						{#snippet children(close)}
							<p class="menuhead">{t('player.audioTrack')}</p>
							{#each player.audioTracks as a (a.id)}
								<button
									class="mitem"
									class:on={player.audioTrackId === a.id}
									onclick={() => {
										player.audioTrackId = a.id;
										close();
									}}
								>
									<span>{a.label}</span>
									{#if player.audioTrackId === a.id}<Icon name="check" size={16} />{/if}
								</button>
							{/each}
							<button class="mitem ghost">
								<Icon name="folder" size={16} />{t('player.externalAudio')}
							</button>
							<div class="split"></div>
							<div class="menuslider">
								<span class="mslabel">{t('player.audioDelay')}</span>
								<Slider
									min={-5000}
									max={5000}
									step={50}
									value={player.audioDelayMs}
									ariaLabel={t('player.audioDelay')}
									valueText={`${digits(player.audioDelayMs)}ms`}
									onchange={(v) => (player.audioDelayMs = v)}
								/>
							</div>
						{/snippet}
					</Menu>

					<!-- subtitles -->
					<Menu placement="top" align="end" bind:open={subsOpen}>
						{#snippet trigger(attrs, open)}
							<button {...attrs} class="ctl" class:active={open} aria-label={t('player.subtitles')}>
								<Icon name="subtitles" size={20} />
							</button>
						{/snippet}
						{#snippet children(close)}
							<p class="menuhead">{t('player.subtitles')}</p>
							<button
								class="mitem"
								class:on={player.subtitleTrackId === null}
								onclick={() => {
									player.subtitleTrackId = null;
									close();
								}}
							>
								<span>{t('common.none')}</span>
							</button>
							{#each player.subtitleTracks as s (s.id)}
								<button
									class="mitem"
									class:on={player.subtitleTrackId === s.id}
									onclick={() => {
										player.subtitleTrackId = s.id;
										close();
									}}
								>
									<span>{s.label}</span>
									{#if player.subtitleTrackId === s.id}<Icon name="check" size={16} />{/if}
								</button>
							{/each}
							<button class="mitem ghost">
								<Icon name="folder" size={16} />{t('player.loadSubtitle')}
							</button>
							<button class="mitem ghost">
								<Icon name="external" size={16} />{t('player.lanUpload')}
							</button>
							<div class="split"></div>
							<button
								class="mitem"
								onclick={() => {
									togglePanel('style');
									close();
								}}
							>
								<Icon name="sliders" size={16} />{t('player.subtitleStyle')}
							</button>
							<button
								class="mitem"
								onclick={() => {
									togglePanel('sync');
									close();
								}}
							>
								<Icon name="gauge" size={16} />{t('player.subtitleSync')}
							</button>
						{/snippet}
					</Menu>

					<Tooltip content={t('player.pip')}>
						<button
							class="ctl"
							aria-label={t('player.pip')}
							class:active={player.pip}
							onclick={() => (player.pip = !player.pip)}
						>
							<Icon name="pip" size={19} />
						</button>
					</Tooltip>
					<Tooltip content={t('player.fullscreen')}>
						<button class="ctl" aria-label={t('player.fullscreen')} onclick={toggleFullscreen}>
							<Icon name="fullscreen" size={19} />
						</button>
					</Tooltip>
				</div>
			</div>
		</div>
	{/if}

	<!-- subtitle style / sync drawer -->
	{#if panel}
		<div class="drawer" transition:fly={{ x: 40, duration: 220 }}>
			<header>
				<h3>{panel === 'style' ? t('player.subtitleStyle') : t('player.subtitleSync')}</h3>
				<Tooltip content={t('common.close')}>
					<button class="ctl" aria-label={t('common.close')} onclick={() => (panel = null)}>
						<Icon name="x" size={18} />
					</button>
				</Tooltip>
			</header>

			{#if panel === 'style'}
				<div class="group">
					<div class="fld">
						<span class="fldlabel">{t('player.font')}</span>
						<SegmentedControl
							size="sm"
							options={FONT_OPTIONS}
							value={player.subtitleStyle.font}
							onchange={(v) => (player.subtitleStyle.font = v)}
						/>
					</div>
					<Slider
						min={50}
						max={220}
						step={5}
						value={player.subtitleStyle.size}
						label={t('player.fontSize')}
						valueText={`${digits(player.subtitleStyle.size)}%`}
						onchange={(v) => (player.subtitleStyle.size = v)}
					/>
					<Slider
						min={0}
						max={80}
						step={1}
						value={player.subtitleStyle.position}
						label={t('player.position')}
						valueText={`${digits(player.subtitleStyle.position)}%`}
						onchange={(v) => (player.subtitleStyle.position = v)}
					/>
					<div class="fld">
						<span class="fldlabel">{t('player.edge')}</span>
						<SegmentedControl
							size="sm"
							options={EDGE_OPTIONS}
							value={player.subtitleStyle.edge}
							onchange={(v) => (player.subtitleStyle.edge = v)}
						/>
					</div>
					<Slider
						min={0}
						max={100}
						step={5}
						value={player.subtitleStyle.background}
						label={t('player.background')}
						valueText={`${digits(player.subtitleStyle.background)}%`}
						onchange={(v) => (player.subtitleStyle.background = v)}
					/>
					<label class="fld colorfld">
						<span class="fldlabel">{t('settings.subtitleDefaults')}</span>
						<input type="color" bind:value={player.subtitleStyle.color} />
					</label>
				</div>
			{:else}
				<div class="group">
					<Slider
						min={-10000}
						max={10000}
						step={100}
						value={player.subtitleSync.delayMs}
						label={t('player.syncDelay')}
						valueText={`${digits(player.subtitleSync.delayMs)}ms`}
						onchange={(v) => (player.subtitleSync.delayMs = v)}
					/>
					<label class="fld"
						>{t('player.syncFps')}
						<select bind:value={player.subtitleSync.fps}>
							<option value={23.976}>23.976</option>
							<option value={24}>24</option>
							<option value={25}>25</option>
							<option value={29.97}>29.97</option>
							<option value={30}>30</option>
						</select>
					</label>
					<div class="fld">
						<span class="fldlabel">{t('player.syncPoints')}</span>
						<p class="hint">
							{#if player.subtitleSync.points.length}
								{digits(player.subtitleSync.points.length)}
							{:else}
								{t('common.none')}
							{/if}
						</p>
						<Button
							size="sm"
							variant="outline"
							icon="plus"
							onclick={() =>
								(player.subtitleSync.points = [
									...player.subtitleSync.points,
									{ at: player.currentTime, shift: player.subtitleSync.delayMs }
								])}
						>
							{t('common.more')}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	{#if loadError}
		<div class="loaderr">
			<p>{t('error.generic')}</p>
			<Button variant="outline" onclick={() => goto('/')}>{t('common.back')}</Button>
		</div>
	{/if}
</div>

<style>
	.player {
		position: relative;
		inline-size: 100%;
		block-size: 100vh;
		background: #000;
		overflow: hidden;
		color: #fff;
		cursor: default;
	}
	.player.idle {
		cursor: none;
	}
	.stage {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		background: none;
		cursor: inherit;
	}
	.stub {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}
	.bigplay {
		inline-size: 92px;
		block-size: 92px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.2);
		backdrop-filter: blur(6px);
		color: #fff;
		animation: breathe 2.4s var(--ease-out) infinite;
	}
	@keyframes breathe {
		50% {
			transform: scale(1.06);
			box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.04);
		}
	}
	.loading .ring {
		inline-size: 54px;
		block-size: 54px;
		border-radius: 50%;
		border: 3px solid rgba(255, 255, 255, 0.2);
		border-top-color: var(--accent);
		display: block;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.fast {
		position: absolute;
		inset-block-start: 12%;
		inset-inline-end: 8%;
		font-weight: 800;
		font-size: 1.4rem;
		color: var(--accent);
		text-shadow: 0 2px 10px #000;
	}
	.subtrack {
		position: absolute;
		inset-inline: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
		padding-inline: 10%;
	}
	.subline {
		padding-inline: 12px;
		padding-block: 4px;
		border-radius: 6px;
		line-height: 1.5;
		text-align: center;
	}
	.top {
		position: absolute;
		inset-block-start: 0;
		inset-inline: 0;
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-4) var(--sp-5);
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.75), transparent);
		z-index: 2;
	}
	.titlebox {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		flex: 1;
		min-inline-size: 0;
	}
	.titlebox b {
		font-size: 1.05rem;
	}
	.titlebox small {
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.78rem;
	}
	.src-note {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.55);
		background: rgba(255, 255, 255, 0.08);
		padding-inline: var(--sp-3);
		padding-block: 5px;
		border-radius: var(--r-full);
	}
	.bar {
		position: absolute;
		inset-block-end: 0;
		inset-inline: 0;
		padding: var(--sp-5);
		padding-block-start: var(--sp-7);
		background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent);
		z-index: 2;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-4);
		margin-block-start: var(--sp-2);
	}
	.left,
	.right {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.ctl {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-inline-size: 40px;
		block-size: 40px;
		justify-content: center;
		border: none;
		background: transparent;
		color: #fff;
		border-radius: var(--r-md);
		transition:
			background var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
		padding-inline: var(--sp-2);
	}
	.ctl:hover {
		background: rgba(255, 255, 255, 0.12);
	}
	.ctl:active {
		transform: scale(0.9);
	}
	.ctl:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.ctl.active {
		color: var(--accent);
	}
	.ctl.txt {
		font-weight: 700;
		font-size: 0.85rem;
	}
	.vol {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
	}
	.volwrap {
		inline-size: 92px;
	}
	.time {
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.85);
		margin-inline-start: var(--sp-2);
		white-space: nowrap;
	}
	/* menu items rendered inside the Menu popover (styles scoped to this page) */
	.menuhead {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-dim);
		padding: var(--sp-2) var(--sp-3);
	}
	.menuhint {
		font-size: 0.72rem;
		color: var(--accent);
		padding: var(--sp-2) var(--sp-3);
	}
	.mitem {
		inline-size: 100%;
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		justify-content: space-between;
		padding-inline: var(--sp-3);
		block-size: 38px;
		border: none;
		background: transparent;
		color: var(--text);
		border-radius: var(--r-sm);
		font-size: 0.88rem;
		text-align: start;
		transition: background var(--dur-fast) var(--ease);
	}
	.mitem:hover {
		background: var(--surface-2);
	}
	.mitem.on {
		color: var(--accent);
	}
	.mitem.ghost {
		color: var(--text-muted);
		justify-content: flex-start;
	}
	.split {
		block-size: 1px;
		background: var(--border);
		margin-block: var(--sp-2);
	}
	.menuslider {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-3);
	}
	.mslabel {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-weight: 600;
	}
	.next {
		position: absolute;
		inset-block-end: 110px;
		inset-inline-end: var(--sp-6);
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		padding: var(--sp-4);
		box-shadow: var(--shadow-lg);
		color: var(--text);
		z-index: 3;
	}
	.next p {
		font-weight: 600;
		margin-block-end: var(--sp-3);
	}
	.nextbtns {
		display: flex;
		gap: var(--sp-2);
	}
	.drawer {
		position: absolute;
		inset-block: 0;
		inset-inline-end: 0;
		inline-size: 340px;
		max-inline-size: 90vw;
		background: var(--elevated);
		border-inline-start: 1px solid var(--border-strong);
		box-shadow: var(--shadow-lg);
		color: var(--text);
		z-index: 4;
		display: flex;
		flex-direction: column;
	}
	.drawer header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--sp-4) var(--sp-5);
		border-block-end: 1px solid var(--border);
	}
	.drawer header .ctl {
		color: var(--text-muted);
	}
	.drawer header .ctl:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.group {
		padding: var(--sp-5);
		display: flex;
		flex-direction: column;
		gap: var(--sp-5);
		overflow-y: auto;
	}
	.fld {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.fldlabel {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.colorfld {
		align-items: flex-start;
	}
	.fld select,
	.fld input[type='color'] {
		block-size: 38px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		color: var(--text);
		padding-inline: var(--sp-2);
	}
	.hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-weight: 400;
	}
	.loaderr {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		gap: var(--sp-4);
		background: var(--bg-deep);
	}
</style>
