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

	let stage = $state<HTMLDivElement | null>(null);
	let controlsVisible = $state(true);
	let menu = $state<'speed' | 'audio' | 'subs' | null>(null);
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
			if (player.status === 'playing' && !menu && !panel) controlsVisible = false;
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
		if (e.target instanceof HTMLInputElement) return;
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
				if (menu || panel) {
					menu = null;
					panel = null;
				}
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
		menu = null;
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
			<button class="ctl" aria-label={t('common.back')} onclick={() => goto('/')}>
				<Icon name="chevron-right" size={22} />
			</button>
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
					<button class="ctl" aria-label={t('common.play')} onclick={() => player.togglePlay()}>
						<Icon name={player.status === 'playing' ? 'pause' : 'play-filled'} size={24} />
					</button>
					<button class="ctl" aria-label="prev" onclick={() => player.seekBy(-10)}>
						<Icon name="rewind" size={20} />
					</button>
					<button class="ctl" aria-label="next" onclick={() => player.seekBy(10)}>
						<Icon name="forward" size={20} />
					</button>
					{#if player.hasNext}
						<button
							class="ctl"
							aria-label={t('player.nextEpisode')}
							onclick={() => player.playNext()}
						>
							<Icon name="skip-next" size={20} />
						</button>
					{/if}
					<div class="vol">
						<button class="ctl" aria-label={t('player.audio')} onclick={() => player.toggleMute()}>
							<Icon
								name={player.muted || player.volume === 0 ? 'volume-mute' : 'volume'}
								size={20}
							/>
						</button>
						<input
							class="volrange"
							type="range"
							min="0"
							max="1"
							step="0.05"
							value={player.muted ? 0 : player.volume}
							oninput={(e) => player.setVolume(Number(e.currentTarget.value))}
							aria-label={t('player.audio')}
						/>
					</div>
					<span class="time latin">
						{timecode(player.currentTime)} / {timecode(player.duration)}
					</span>
				</div>

				<div class="right">
					<!-- speed -->
					<div class="pop">
						<button class="ctl txt" onclick={() => (menu = menu === 'speed' ? null : 'speed')}>
							<Icon name="gauge" size={19} /><span class="latin">{player.rate}×</span>
						</button>
						{#if menu === 'speed'}
							<div class="menu" transition:fly={{ y: 8, duration: 150 }}>
								<p class="menuhint">{t('player.holdFor2x')}</p>
								{#each SPEEDS as s (s)}
									<button
										class="mitem"
										class:on={player.rate === s}
										onclick={() => {
											player.setRate(s);
											menu = null;
										}}
									>
										<span class="latin">{s}×</span>
										{#if player.rate === s}<Icon name="check" size={16} />{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- audio tracks -->
					<div class="pop">
						<button
							class="ctl"
							aria-label={t('player.audioTrack')}
							onclick={() => (menu = menu === 'audio' ? null : 'audio')}
						>
							<Icon name="volume" size={19} />
						</button>
						{#if menu === 'audio'}
							<div class="menu" transition:fly={{ y: 8, duration: 150 }}>
								<p class="menuhead">{t('player.audioTrack')}</p>
								{#each player.audioTracks as a (a.id)}
									<button
										class="mitem"
										class:on={player.audioTrackId === a.id}
										onclick={() => {
											player.audioTrackId = a.id;
											menu = null;
										}}
									>
										<span>{a.label}</span>
										{#if player.audioTrackId === a.id}<Icon name="check" size={16} />{/if}
									</button>
								{/each}
								<button class="mitem ghost"
									><Icon name="folder" size={16} />{t('player.externalAudio')}</button
								>
								<label class="delay">
									{t('player.audioDelay')}
									<input
										type="range"
										min="-5000"
										max="5000"
										step="50"
										value={player.audioDelayMs}
										oninput={(e) => (player.audioDelayMs = Number(e.currentTarget.value))}
									/>
									<span class="latin">{digits(player.audioDelayMs)}ms</span>
								</label>
							</div>
						{/if}
					</div>

					<!-- subtitles -->
					<div class="pop">
						<button
							class="ctl"
							aria-label={t('player.subtitles')}
							onclick={() => (menu = menu === 'subs' ? null : 'subs')}
						>
							<Icon name="subtitles" size={20} />
						</button>
						{#if menu === 'subs'}
							<div class="menu" transition:fly={{ y: 8, duration: 150 }}>
								<p class="menuhead">{t('player.subtitles')}</p>
								<button
									class="mitem"
									class:on={player.subtitleTrackId === null}
									onclick={() => {
										player.subtitleTrackId = null;
										menu = null;
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
											menu = null;
										}}
									>
										<span>{s.label}</span>
										{#if player.subtitleTrackId === s.id}<Icon name="check" size={16} />{/if}
									</button>
								{/each}
								<button class="mitem ghost"
									><Icon name="folder" size={16} />{t('player.loadSubtitle')}</button
								>
								<button class="mitem ghost"
									><Icon name="external" size={16} />{t('player.lanUpload')}</button
								>
								<div class="split"></div>
								<button
									class="mitem"
									onclick={() => {
										togglePanel('style');
										menu = null;
									}}
								>
									<Icon name="sliders" size={16} />{t('player.subtitleStyle')}
								</button>
								<button
									class="mitem"
									onclick={() => {
										togglePanel('sync');
										menu = null;
									}}
								>
									<Icon name="gauge" size={16} />{t('player.subtitleSync')}
								</button>
							</div>
						{/if}
					</div>

					<button
						class="ctl"
						aria-label={t('player.pip')}
						class:active={player.pip}
						onclick={() => (player.pip = !player.pip)}
					>
						<Icon name="pip" size={19} />
					</button>
					<button class="ctl" aria-label={t('player.fullscreen')} onclick={toggleFullscreen}>
						<Icon name="fullscreen" size={19} />
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- subtitle style / sync drawer -->
	{#if panel}
		<div class="drawer" transition:fly={{ x: 40, duration: 220 }}>
			<header>
				<h3>{panel === 'style' ? t('player.subtitleStyle') : t('player.subtitleSync')}</h3>
				<button class="ctl" aria-label={t('common.close')} onclick={() => (panel = null)}>
					<Icon name="x" size={18} />
				</button>
			</header>

			{#if panel === 'style'}
				<div class="group">
					<label class="fld"
						>{t('player.font')}
						<select bind:value={player.subtitleStyle.font}>
							<option value="Vazirmatn">Vazirmatn</option>
							<option value="Estedad">Estedad</option>
							<option value="Inter">Inter</option>
						</select>
					</label>
					<label class="fld"
						>{t('player.fontSize')} <span class="latin">{digits(player.subtitleStyle.size)}%</span>
						<input
							type="range"
							min="50"
							max="220"
							step="5"
							bind:value={player.subtitleStyle.size}
						/>
					</label>
					<label class="fld"
						>{t('player.position')}
						<span class="latin">{digits(player.subtitleStyle.position)}%</span>
						<input
							type="range"
							min="0"
							max="80"
							step="1"
							bind:value={player.subtitleStyle.position}
						/>
					</label>
					<div class="fld">
						{t('player.edge')}
						<div class="segrow">
							{#each EDGE_OPTIONS as e (e.value)}
								<button
									class="seg"
									class:on={player.subtitleStyle.edge === e.value}
									onclick={() => (player.subtitleStyle.edge = e.value)}>{e.label}</button
								>
							{/each}
						</div>
					</div>
					<label class="fld"
						>{t('player.background')}
						<span class="latin">{digits(player.subtitleStyle.background)}%</span>
						<input
							type="range"
							min="0"
							max="100"
							step="5"
							bind:value={player.subtitleStyle.background}
						/>
					</label>
					<label class="fld"
						>{t('settings.subtitleDefaults')}
						<input type="color" bind:value={player.subtitleStyle.color} />
					</label>
				</div>
			{:else}
				<div class="group">
					<label class="fld"
						>{t('player.syncDelay')}
						<span class="latin">{digits(player.subtitleSync.delayMs)}ms</span>
						<input
							type="range"
							min="-10000"
							max="10000"
							step="100"
							bind:value={player.subtitleSync.delayMs}
						/>
					</label>
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
						<span>{t('player.syncPoints')}</span>
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
		transition: background var(--dur-fast) var(--ease);
		padding-inline: var(--sp-2);
	}
	.ctl:hover {
		background: rgba(255, 255, 255, 0.12);
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
	.volrange {
		inline-size: 84px;
		accent-color: var(--accent);
	}
	.time {
		font-size: 0.82rem;
		color: rgba(255, 255, 255, 0.85);
		margin-inline-start: var(--sp-2);
		white-space: nowrap;
	}
	.pop {
		position: relative;
	}
	.menu {
		position: absolute;
		inset-block-end: calc(100% + 10px);
		inset-inline-end: 0;
		min-inline-size: 220px;
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-lg);
		padding: var(--sp-2);
		color: var(--text);
	}
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
	.delay {
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		padding: var(--sp-3);
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.delay input {
		accent-color: var(--accent);
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
	.fld input[type='range'] {
		accent-color: var(--accent);
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
	.segrow {
		display: flex;
		gap: 4px;
	}
	.seg {
		flex: 1;
		block-size: 34px;
		border: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-muted);
		border-radius: var(--r-sm);
		font-size: 0.78rem;
	}
	.seg.on {
		border-color: var(--accent);
		color: var(--accent);
		background: var(--accent-soft);
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
