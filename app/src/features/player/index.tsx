import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Copy, ExternalLink, Play } from '@lucide/react';
import { Button, Icon, Spinner } from '../../components/ui';
import { useI18n } from '../../i18n';
import type { FileV2, GroupInfoV2 } from '../../lib/api/types';
import { useFiles, useItem, useWatch } from '../../lib/query';
import { usePlayerStore } from '../../lib/stores/player';
import { useSessionStore } from '../../lib/stores/session';
import { cn } from '../../lib/util/cn';
import { ControlBar } from './components/ControlBar';
import { NextEpisode } from './components/NextEpisode';
import { SubtitlePanel } from './components/SubtitlePanel';
import { TopBar } from './components/TopBar';
import { buildStreamUrl } from './lib/playback';
import { usePlayerController } from './hooks/usePlayerController';
import { useActiveCue } from './lib/subtitles';
import { usePlayerChrome, type SubtitleEdge } from './store';

interface Found {
	file: FileV2;
	list: FileV2[];
	index: number;
}

function firstPlayable(node: GroupInfoV2 | null): Found | null {
	if (!node) return null;
	// Prefer a real media file; skip external/trailer urns (YouTube/Aparat links)
	// — those are opened in the browser, not run through the HLS transcoder.
	const idx = node.Files.findIndex((f) => !/^https?:\/\//i.test(f.urn));
	if (idx >= 0) return { file: node.Files[idx], list: node.Files, index: idx };
	for (const c of node.Child) {
		const r = firstPlayable(c);
		if (r) return r;
	}
	return null;
}

function findContaining(node: GroupInfoV2 | null, file: FileV2): Found | null {
	if (!node) return null;
	const idx = node.Files.findIndex((f) => f.urn === file.urn || f.id === file.id);
	if (idx >= 0) return { file: node.Files[idx], list: node.Files, index: idx };
	for (const c of node.Child) {
		const r = findContaining(c, file);
		if (r) return r;
	}
	return null;
}

function edgeShadow(edge: SubtitleEdge): string {
	switch (edge) {
		case 'outline':
			return '0 0 2px #000, 0 0 2px #000, 1px 1px 2px #000';
		case 'drop':
			return '2px 2px 4px rgba(0,0,0,0.9)';
		case 'raised':
			return '1px 1px 0 rgba(255,255,255,0.4), -1px -1px 2px rgba(0,0,0,0.9)';
		default:
			return 'none';
	}
}

export default function PlayerScreen() {
	const { t } = useI18n();
	const reduce = useReducedMotion();
	const router = useRouter();
	const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
	const searchId = Number(search?.id);
	const source = usePlayerStore((s) => s.source);
	const setSource = usePlayerStore((s) => s.setSource);
	const titleId = source?.title?.id ?? (Number.isFinite(searchId) && searchId > 0 ? searchId : 0);

	const videoRef = useRef<HTMLVideoElement>(null);
	const controller = usePlayerController(videoRef);

	// Record watch progress to the backend so the title appears in history and the
	// position is saved (operator/watch). Every 25s while playing + once on leave,
	// provided at least 20s has been watched. (Reading the position back for in-app
	// resume needs the native websocket sync, which we don't speak yet.)
	const watch = useWatch();
	const watchRef = useRef(watch);
	watchRef.current = watch;
	useEffect(() => {
		const record = () => {
			const p = usePlayerStore.getState();
			const tid = p.source?.title?.id;
			const fid = p.source?.file?.id;
			if (!tid || !fid || p.duration <= 0 || p.position < 20) return;
			watchRef.current.mutate({
				fid,
				tid,
				length: Math.round(p.duration),
				last: Math.round(p.position),
				on: 1
			});
		};
		const id = setInterval(() => {
			if (usePlayerStore.getState().playing) record();
		}, 25000);
		return () => {
			clearInterval(id);
			record();
		};
	}, []);

	const status = usePlayerChrome((s) => s.status);
	const errorKind = usePlayerChrome((s) => s.playbackErrorKind);
	const holdingFast = usePlayerChrome((s) => s.holdingFast);
	const lock = usePlayerChrome((s) => s.lock);
	const panel = usePlayerChrome((s) => s.panel);
	const subId = usePlayerChrome((s) => s.subtitleTrackId);
	const subStyle = usePlayerChrome((s) => s.subtitleStyle);
	const subTracks = usePlayerChrome((s) => s.subtitleTracks);
	const subSync = usePlayerChrome((s) => s.subtitleSync);
	const patch = usePlayerChrome((s) => s.patch);

	// Real subtitle rendering: fetch + parse the selected text track's WebVTT and
	// show the cue active at the current position (shifted by the sync delay). The
	// previous build only ever painted a hardcoded sample string.
	const position = usePlayerStore((s) => s.position);
	const activeSub = subTracks.find((s) => s.id === subId) ?? null;
	const cueText = useActiveCue(activeSub?.vtt ?? null, position, subSync.delayMs);

	const itemQ = useItem(titleId);
	const filesQ = useFiles(titleId);

	const stageRef = useRef<HTMLDivElement>(null);
	const [controlsVisible, setControlsVisible] = useState(true);
	const [menuOpen, setMenuOpen] = useState(false);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const held = useRef(false);
	const startedRef = useRef(false);

	const noSource = !source?.file && !titleId;
	const failed = noSource || itemQ.isError || filesQ.isError;

	// Bootstrap: build playlist from the title files, seed stores, load + play.
	useEffect(() => {
		if (startedRef.current || failed) return;
		const handed = usePlayerStore.getState().source?.file ?? null;
		const tree = filesQ.data?.Items ?? null;
		if (!filesQ.data && !handed) return;
		const title = usePlayerStore.getState().source?.title ?? itemQ.data ?? null;
		if (!handed && !itemQ.data) return;
		let found: Found | null = null;
		if (handed) found = findContaining(tree, handed) ?? { file: handed, list: [handed], index: 0 };
		else found = firstPlayable(tree);
		if (!found) return;
		startedRef.current = true;
		const f = found;
		setSource({ ...(usePlayerStore.getState().source ?? {}), title, file: f.file, urn: f.file.urn });
		void controller.load({ title, file: f.file, playlist: f.list, index: f.index }).then(() => controller.play());
	}, [failed, filesQ.data, itemQ.data, controller, setSource]);

	const noPlayable = !failed && !!filesQ.data && !startedRef.current && !source?.file && !firstPlayable(filesQ.data.Items);

	const showControls = useCallback(() => {
		setControlsVisible(true);
		if (hideTimer.current) clearTimeout(hideTimer.current);
		hideTimer.current = setTimeout(() => {
			const c = usePlayerChrome.getState();
			if (c.status === 'playing' && c.panel === null) setControlsVisible(false);
		}, 3000);
	}, []);

	// menus open => keep visible (the timer re-checks menuOpen via this effect)
	useEffect(() => {
		if (menuOpen) {
			if (hideTimer.current) clearTimeout(hideTimer.current);
			setControlsVisible(true);
		} else {
			showControls();
		}
	}, [menuOpen, showControls]);

	useEffect(
		() => () => {
			if (hideTimer.current) clearTimeout(hideTimer.current);
			if (holdTimer.current) clearTimeout(holdTimer.current);
		},
		[],
	);

	const goBack = useCallback(() => {
		try {
			router.history.back();
		} catch {
			void router.navigate({ to: '/' });
		}
	}, [router]);

	const toggleFullscreen = useCallback(() => controller.toggleFullscreen(stageRef.current), [controller]);

	useEffect(() => {
		const onFs = () => usePlayerStore.getState().setFullscreen(!!document.fullscreenElement);
		document.addEventListener('fullscreenchange', onFs);
		return () => document.removeEventListener('fullscreenchange', onFs);
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target instanceof HTMLElement ? e.target : null;
			if (el && (el.tagName === 'INPUT' || el.closest('[role="slider"]'))) return;
			if (usePlayerChrome.getState().lock) {
				showControls();
				return;
			}
			const p = usePlayerStore.getState();
			switch (e.key) {
				case ' ':
				case 'k':
					e.preventDefault();
					controller.togglePlay();
					break;
				case 'ArrowRight':
					controller.seekBy(10);
					break;
				case 'ArrowLeft':
					controller.seekBy(-10);
					break;
				case 'ArrowUp':
					e.preventDefault();
					controller.setVolume(p.volume + 0.1);
					break;
				case 'ArrowDown':
					e.preventDefault();
					controller.setVolume(p.volume - 0.1);
					break;
				case 'm':
					controller.toggleMute();
					break;
				case 'f':
					toggleFullscreen();
					break;
				case 'Escape':
					if (usePlayerChrome.getState().panel) patch({ panel: null });
					break;
			}
			showControls();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [controller, patch, showControls, toggleFullscreen]);

	const onStageDown = () => {
		if (lock) return;
		held.current = false;
		holdTimer.current = setTimeout(() => {
			held.current = true;
			controller.setHoldFast(true);
		}, 220);
	};
	const onStageUp = () => {
		if (lock) {
			showControls();
			return;
		}
		if (holdTimer.current) clearTimeout(holdTimer.current);
		if (held.current) {
			controller.setHoldFast(false);
			held.current = false;
		} else {
			controller.togglePlay();
		}
	};
	const onStageKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
		// Space/Enter on the focused stage is handled by the window shortcut handler.
		if (e.key === 'Enter') controller.togglePlay();
	};

	const streamUrl = (() => {
		const base = useSessionStore.getState().assetBase();
		return source?.file && base ? buildStreamUrl(base, source.file) : '';
	})();
	const oskol = (
		window as unknown as {
			oskol?: { clipboardWrite?: (t: string) => unknown; openExternal?: (u: string) => unknown };
		}
	).oskol;
	const copyLink = () => {
		if (!streamUrl) return;
		if (oskol?.clipboardWrite) void oskol.clipboardWrite(streamUrl);
		else void navigator.clipboard?.writeText(streamUrl)?.catch(() => undefined);
	};
	const showUnsupported = status === 'error' && errorKind === 'unsupported';

	const idle = !controlsVisible && status === 'playing' && !menuOpen && !panel;
	const loading = status === 'loading' || (!failed && !noPlayable && status === 'idle');
	const showBigPlay = status !== 'playing' && !loading;

	if (failed || noPlayable) {
		return (
			<div className="relative flex h-[calc(100vh-3.5rem)] min-h-[30rem] w-full flex-col items-center justify-center gap-4 overflow-hidden bg-black text-white">
				<p className="text-sm text-white/80">{t('error.generic')}</p>
				<Button variant="outline" onClick={goBack}>
					{t('common.back')}
				</Button>
			</div>
		);
	}

	return (
		<div
			ref={stageRef}
			role="application"
			aria-label={source?.title?.persian ?? 'player'}
			onMouseMove={showControls}
			className={cn(
				'relative h-[calc(100vh-3.5rem)] min-h-[30rem] w-full overflow-hidden bg-black text-white',
				idle && 'cursor-none',
			)}
		>
			{/* HLS playback surface: HlsPlaybackSource attaches hls.js to the <video>. */}
			<div
				className="absolute inset-0 select-none"
				style={{ background: 'radial-gradient(120% 90% at 50% 40%, #0d0d10, #000)' }}
				onPointerDown={onStageDown}
				onPointerUp={onStageUp}
				onKeyDown={onStageKey}
				role="button"
				tabIndex={0}
				aria-label={t('common.play')}
			>
				<video ref={videoRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" playsInline />
				<div className="pointer-events-none absolute inset-0 grid place-items-center">
					{loading ? (
						<Spinner size={44} label="Loading" />
					) : showBigPlay ? (
						<motion.div
							className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-white"
							animate={reduce ? undefined : { scale: [1, 1.08, 1] }}
							transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
						>
							<Icon icon={Play} size={38} className="fill-current" />
						</motion.div>
					) : null}
				</div>
				<AnimatePresence>
					{holdingFast ? (
						<motion.div
							key="fast"
							className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-sm"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.1 }}
						>
							2× ▶▶
						</motion.div>
					) : null}
				</AnimatePresence>
				{(() => {
					// Show the active cue; while the style panel is open, fall back to a
					// sample line so the user can see their styling even between cues.
					const text = cueText || (panel === 'style' ? t('player.subtitlePreview') : '');
					if (!subId || !text) return null;
					return (
						<div
							className="pointer-events-none absolute inset-x-0 flex justify-center px-6"
							style={{ bottom: `${subStyle.position}%` }}
						>
							<span
								className="rounded px-2 py-0.5 text-center whitespace-pre-line"
								style={{
									fontFamily: `'${subStyle.font} Variable', '${subStyle.font}', sans-serif`,
									fontSize: `${(subStyle.size / 100) * 1.8}rem`,
									color: subStyle.color,
									textShadow: edgeShadow(subStyle.edge),
									background: `rgba(0,0,0,${subStyle.background / 100})`,
								}}
							>
								{text}
							</span>
						</div>
					);
				})()}
			</div>

			<AnimatePresence>
				{controlsVisible ? <TopBar key="top" onBack={goBack} /> : null}
			</AnimatePresence>
			<NextEpisode onPlayNow={() => void controller.playNext()} onCancel={controller.cancelNextCountdown} />
			<AnimatePresence>
				{controlsVisible ? (
					<ControlBar
						key="bar"
						controller={controller}
						onToggleFullscreen={toggleFullscreen}
						onMenuOpenChange={setMenuOpen}
					/>
				) : null}
			</AnimatePresence>
			<SubtitlePanel />
		</div>
	);
}
