/**
 * Wires a PlaybackSource to the foundation player store (core transport) and the
 * feature-local chrome store (extended state). Components call the returned
 * actions; they never touch the source directly.
 */
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { usePlayerStore } from '../../../lib/stores/player';
import { useSessionStore } from '../../../lib/stores/session';
import { HlsPlaybackSource, StubPlaybackSource, type PlaybackMeta, type PlaybackRequest, type PlaybackSource, type PlaybackState } from '../lib/playback';
import { usePlayerChrome, type AudioTrack, type SubtitleTrack } from '../store';

export interface PlayerController {
	load: (req: PlaybackRequest) => Promise<void>;
	play: () => void;
	pause: () => void;
	togglePlay: () => void;
	seek: (seconds: number) => void;
	seekBy: (delta: number) => void;
	setRate: (rate: number) => void;
	setHoldFast: (on: boolean) => void;
	setVolume: (v: number) => void;
	toggleMute: () => void;
	playNext: () => Promise<void>;
	startNextCountdown: (from?: number) => void;
	cancelNextCountdown: () => void;
	toggleFullscreen: (stage: HTMLElement | null) => void;
	togglePip: () => void;
	toggleLock: () => void;
}

export function usePlayerController(videoRef: RefObject<HTMLVideoElement | null>): PlayerController {
	const sourceRef = useRef<PlaybackSource | null>(null);
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
	// The last request handed to load(), and whether the player wants it playing.
	// If the source is recreated (StrictMode remount, video element swap) while a
	// load is in flight, the new source re-applies this so playback isn't lost.
	const lastReqRef = useRef<PlaybackRequest | null>(null);
	const playIntentRef = useRef(false);
	const clearCountdownTimer = useCallback(() => {
		if (countdownRef.current) {
			clearInterval(countdownRef.current);
			countdownRef.current = null;
		}
	}, []);

	const actions = useMemo<PlayerController>(() => {
		const player = () => usePlayerStore.getState();
		const chrome = () => usePlayerChrome.getState();
		const src = () => sourceRef.current;

		const load = async (req: PlaybackRequest): Promise<void> => {
			lastReqRef.current = req;
			chrome().patch({ nextCountdown: null, playlist: req.playlist, index: req.index });
			// Real tracks + thumbnail base are patched into the store by the source's
			// onMeta callback (see the effect below) — which fires on any load path.
			await src()?.load(req);
		};

		const play = () => {
			playIntentRef.current = true;
			src()?.play();
		};
		const pause = () => {
			playIntentRef.current = false;
			src()?.pause();
		};
		const togglePlay = () => {
			if (chrome().status === 'playing') pause();
			else play();
		};
		const seek = (s: number) => src()?.seek(s);
		const seekBy = (d: number) => src()?.seek(player().position + d);

		const setRate = (rate: number) => {
			player().setRate(rate);
			src()?.setRate(chrome().holdingFast ? 2 : rate);
		};
		const setHoldFast = (on: boolean) => {
			chrome().patch({ holdingFast: on });
			src()?.setRate(on ? 2 : player().rate);
		};
		const setVolume = (v: number) => {
			const vol = Math.max(0, Math.min(1, v));
			player().setVolume(vol);
			player().setMuted(vol === 0);
			src()?.setVolume(vol);
		};
		const toggleMute = () => {
			const muted = !player().muted;
			player().setMuted(muted);
			src()?.setVolume(muted ? 0 : player().volume);
		};

		const cancelNextCountdown = () => {
			chrome().patch({ nextCountdown: null });
			clearCountdownTimer();
		};

		const playNext = async (): Promise<void> => {
			clearCountdownTimer();
			const { playlist, index } = chrome();
			if (index >= playlist.length - 1) {
				chrome().patch({ nextCountdown: null });
				return;
			}
			const next = index + 1;
			const file = playlist[next];
			const cur = player().source;
			chrome().patch({ nextCountdown: null, index: next });
			player().setSource({ ...(cur ?? {}), file, urn: file.urn });
			await src()?.load({ title: cur?.title ?? null, file, playlist, index: next });
			src()?.play();
		};

		const startNextCountdown = (from = 10) => {
			chrome().patch({ nextCountdown: from });
			if (typeof window === 'undefined') return;
			clearCountdownTimer();
			countdownRef.current = setInterval(() => {
				const n = chrome().nextCountdown;
				if (n == null) return;
				if (n <= 1) {
					clearCountdownTimer();
					void playNext();
				} else {
					chrome().patch({ nextCountdown: n - 1 });
				}
			}, 1000);
		};

		const toggleFullscreen = (stage: HTMLElement | null) => {
			if (typeof document === 'undefined') return;
			if (!document.fullscreenElement) {
				stage?.requestFullscreen?.().catch(() => undefined);
				player().setFullscreen(true);
			} else {
				document.exitFullscreen?.().catch(() => undefined);
				player().setFullscreen(false);
			}
		};

		return {
			load,
			play,
			pause,
			togglePlay,
			seek,
			seekBy,
			setRate,
			setHoldFast,
			setVolume,
			toggleMute,
			playNext,
			startNextCountdown,
			cancelNextCountdown,
			toggleFullscreen,
			togglePip: () => chrome().patch({ pip: !chrome().pip }),
			toggleLock: () => chrome().patch({ lock: !chrome().lock }),
		};
	}, [clearCountdownTimer]);

	// Create the source, subscribe, mirror state into both stores.
	useEffect(() => {
		// The source's lifecycle follows the <video> element, NOT the asset base.
		// assetBase is read lazily at load() time (via the getter) so a core status
		// refresh never tears down an in-flight load. onMeta patches the real tracks
		// + thumbnail base into the chrome store whenever a load resolves.
		const video = videoRef.current;
		const onMeta = (meta: PlaybackMeta) => {
			const audioTracks: AudioTrack[] = meta.audioTracks.map((a) => ({ id: a.id, label: a.label, lang: a.lang ?? '' }));
			const subtitleTracks: SubtitleTrack[] = meta.subtitleTracks.map((s) => ({
				id: s.id,
				label: s.label,
				lang: s.lang ?? '',
				source: s.source,
			}));
			usePlayerChrome.getState().patch({
				audioTracks,
				audioTrackId: audioTracks[0]?.id ?? '',
				subtitleTracks,
				subtitleTrackId: subtitleTracks[0]?.id ?? null,
				thumbBase: meta.thumbBase ?? null,
				storyboardInterval: meta.storyboardInterval ?? 10,
				storyboardCount: meta.storyboardCount ?? 0,
				playlistUrl: meta.playlistUrl ?? null,
			});
		};
		const source: PlaybackSource = video
			? new HlsPlaybackSource(video, () => useSessionStore.getState().assetBase(), onMeta)
			: new StubPlaybackSource();
		sourceRef.current = source;
		const unsub = source.subscribe((s: PlaybackState) => {
			const player = usePlayerStore.getState();
			const chrome = usePlayerChrome.getState();
			player.setPosition(s.currentTime);
			player.setDuration(s.duration);
			player.setPlaying(s.status === 'playing');
			const errorKind = s.status === 'error' ? (s.errorKind ?? 'generic') : null;
			if (
				chrome.status !== s.status ||
				chrome.buffered !== s.buffered ||
				chrome.playbackErrorKind !== errorKind
			) {
				chrome.patch({ status: s.status, buffered: s.buffered, playbackErrorKind: errorKind });
			}
			if (s.status === 'ended' && chrome.index < chrome.playlist.length - 1 && chrome.nextCountdown == null) {
				actions.startNextCountdown(10);
			}
		});
		// If a load was already requested when this source was (re)created — e.g. a
		// StrictMode remount, or the video element being swapped mid-playback — the
		// previous source was torn down before/while its load resolved. Re-apply the
		// last request on the fresh source so playback is never silently lost.
		if (lastReqRef.current) {
			const req = lastReqRef.current;
			void source.load(req).then(() => {
				if (playIntentRef.current) source.play();
			});
		}
		return () => {
			clearCountdownTimer();
			unsub();
			source.dispose();
			sourceRef.current = null;
			usePlayerStore.getState().setPlaying(false);
			usePlayerChrome.getState().resetChrome();
		};
	}, [actions, clearCountdownTimer, videoRef]);

	return actions;
}
