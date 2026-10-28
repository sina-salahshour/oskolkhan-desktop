/**
 * Player store + the PlaybackSource seam.
 *
 * Phase 1 ships the full player CHROME wired to a StubPlaybackSource that just
 * advances a timeline. Real playback (libmpv / native pipe through the core) is
 * phase 2: it only needs to provide a class implementing `PlaybackSource` and be
 * swapped in via `player.useSource(...)`. No UI code needs to change.
 */
import { browser } from '$app/env';
import type { FileV2, GenericTitle } from '$lib/api';

export interface PlaybackRequest {
	title: GenericTitle | null;
	file: FileV2 | null;
	/** sibling files (episodes / parts) for next-episode + playlist */
	playlist: FileV2[];
	index: number;
	startAt?: number;
}

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface PlaybackState {
	status: PlaybackStatus;
	currentTime: number;
	duration: number;
	buffered: number;
}

/**
 * The seam. A real backend implements this (e.g. driving libmpv via Tauri
 * commands and reporting position back). The UI only ever talks to this.
 */
export interface PlaybackSource {
	readonly kind: 'stub' | 'html5' | 'mpv';
	load(req: PlaybackRequest): Promise<void>;
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	setRate(rate: number): void;
	setVolume(v01: number): void;
	dispose(): void;
	subscribe(cb: (state: PlaybackState) => void): () => void;
}

/** Fake timeline so the chrome is fully interactive without a real decoder. */
class StubPlaybackSource implements PlaybackSource {
	readonly kind = 'stub' as const;
	#state: PlaybackState = { status: 'idle', currentTime: 0, duration: 0, buffered: 0 };
	#subs = new Set<(s: PlaybackState) => void>();
	#timer: ReturnType<typeof setInterval> | null = null;
	#rate = 1;

	#emit(next: Partial<PlaybackState>) {
		this.#state = { ...this.#state, ...next };
		for (const cb of this.#subs) cb(this.#state);
	}

	async load(req: PlaybackRequest) {
		this.#emit({ status: 'loading', currentTime: req.startAt ?? 0, buffered: 0 });
		// pretend to buffer a movie / episode
		const duration = 60 * (90 + Math.floor(Math.random() * 40));
		await new Promise((r) => setTimeout(r, 400));
		this.#emit({ status: 'paused', duration, buffered: (req.startAt ?? 0) + 30 });
	}

	play() {
		if (this.#state.status === 'ended') this.#emit({ currentTime: 0 });
		this.#emit({ status: 'playing' });
		this.#tick();
	}

	pause() {
		this.#emit({ status: 'playing' === this.#state.status ? 'paused' : this.#state.status });
		this.#stop();
	}

	seek(seconds: number) {
		const t = Math.max(0, Math.min(seconds, this.#state.duration));
		this.#emit({ currentTime: t, buffered: Math.min(this.#state.duration, t + 30) });
	}

	setRate(rate: number) {
		this.#rate = rate;
	}

	setVolume() {
		/* stub: volume handled in UI only */
	}

	dispose() {
		this.#stop();
		this.#subs.clear();
		this.#state = { status: 'idle', currentTime: 0, duration: 0, buffered: 0 };
	}

	subscribe(cb: (s: PlaybackState) => void) {
		this.#subs.add(cb);
		cb(this.#state);
		return () => this.#subs.delete(cb);
	}

	#tick() {
		this.#stop();
		if (!browser) return;
		this.#timer = setInterval(() => {
			if (this.#state.status !== 'playing') return;
			const next = this.#state.currentTime + this.#rate;
			if (next >= this.#state.duration) {
				this.#emit({ currentTime: this.#state.duration, status: 'ended' });
				this.#stop();
			} else {
				this.#emit({
					currentTime: next,
					buffered: Math.min(this.#state.duration, next + 30)
				});
			}
		}, 1000);
	}

	#stop() {
		if (this.#timer) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
	}
}

export interface AudioTrack {
	id: string;
	label: string;
	lang: string;
	external?: boolean;
}

export interface SubtitleTrack {
	id: string;
	label: string;
	lang: string;
	source: 'embedded' | 'server' | 'local' | 'lan';
}

export interface SubtitleStyle {
	font: string;
	size: number; // percentage
	position: number; // 0..100 from bottom
	edge: 'none' | 'outline' | 'drop' | 'raised';
	background: number; // 0..100
	color: string;
}

export interface SubtitleSync {
	delayMs: number;
	fps: number;
	points: { at: number; shift: number }[];
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

class PlayerStore {
	request = $state<PlaybackRequest>({ title: null, file: null, playlist: [], index: 0 });

	status = $state<PlaybackStatus>('idle');
	currentTime = $state(0);
	duration = $state(0);
	buffered = $state(0);

	volume = $state(1);
	muted = $state(false);
	rate = $state(1);
	holdingFast = $state(false);
	fullscreen = $state(false);
	pip = $state(false);

	audioTracks = $state<AudioTrack[]>([]);
	audioTrackId = $state<string>('');
	audioDelayMs = $state(0);

	subtitleTracks = $state<SubtitleTrack[]>([]);
	subtitleTrackId = $state<string | null>(null);
	subtitleStyle = $state<SubtitleStyle>({
		font: 'Vazirmatn',
		size: 100,
		position: 8,
		edge: 'outline',
		background: 35,
		color: '#ffffff'
	});
	subtitleSync = $state<SubtitleSync>({ delayMs: 0, fps: 23.976, points: [] });

	nextCountdown = $state<number | null>(null);

	#source: PlaybackSource = new StubPlaybackSource();
	#unsub: (() => void) | null = null;

	get source() {
		return this.#source;
	}

	get hasNext() {
		return this.request.index < this.request.playlist.length - 1;
	}

	get progress() {
		return this.duration > 0 ? this.currentTime / this.duration : 0;
	}

	get effectiveRate() {
		return this.holdingFast ? 2 : this.rate;
	}

	/** Swap the playback backend (phase 2 drops a real source in here). */
	useSource(source: PlaybackSource) {
		this.#unsub?.();
		this.#source.dispose();
		this.#source = source;
		this.#wire();
	}

	#wire() {
		this.#unsub = this.#source.subscribe((s) => {
			this.status = s.status;
			this.currentTime = s.currentTime;
			this.duration = s.duration;
			this.buffered = s.buffered;
			if (s.status === 'ended' && this.hasNext && this.nextCountdown == null) {
				this.startNextCountdown();
			}
		});
	}

	async open(req: PlaybackRequest) {
		if (!this.#unsub) this.#wire();
		this.request = req;
		this.audioTracks = [
			{ id: 'a0', label: 'اصلی', lang: 'en' },
			{ id: 'a1', label: 'دوبله فارسی', lang: 'fa' }
		];
		this.audioTrackId = 'a0';
		this.subtitleTracks = [
			{ id: 's0', label: 'فارسی', lang: 'fa', source: 'server' },
			{ id: 's1', label: 'English (SDH)', lang: 'en', source: 'embedded' }
		];
		this.subtitleTrackId = 's0';
		this.nextCountdown = null;
		await this.#source.load(req);
	}

	play() {
		this.#source.play();
	}
	pause() {
		this.#source.pause();
	}
	togglePlay() {
		if (this.status === 'playing') this.pause();
		else this.play();
	}
	seek(seconds: number) {
		this.#source.seek(seconds);
	}
	seekBy(delta: number) {
		this.#source.seek(this.currentTime + delta);
	}
	setRate(rate: number) {
		this.rate = rate;
		this.#source.setRate(this.holdingFast ? 2 : rate);
	}
	setHoldFast(on: boolean) {
		this.holdingFast = on;
		this.#source.setRate(on ? 2 : this.rate);
	}
	setVolume(v: number) {
		this.volume = Math.max(0, Math.min(1, v));
		this.muted = this.volume === 0;
		this.#source.setVolume(this.volume);
	}
	toggleMute() {
		this.muted = !this.muted;
		this.#source.setVolume(this.muted ? 0 : this.volume);
	}

	#countdownTimer: ReturnType<typeof setInterval> | null = null;
	startNextCountdown(from = 10) {
		this.nextCountdown = from;
		if (!browser) return;
		this.#clearCountdown();
		this.#countdownTimer = setInterval(() => {
			if (this.nextCountdown == null) return;
			if (this.nextCountdown <= 1) {
				this.#clearCountdown();
				this.playNext();
			} else {
				this.nextCountdown -= 1;
			}
		}, 1000);
	}
	cancelNextCountdown() {
		this.nextCountdown = null;
		this.#clearCountdown();
	}
	#clearCountdown() {
		if (this.#countdownTimer) {
			clearInterval(this.#countdownTimer);
			this.#countdownTimer = null;
		}
	}

	async playNext() {
		if (!this.hasNext) return;
		const index = this.request.index + 1;
		await this.open({ ...this.request, file: this.request.playlist[index], index });
		this.play();
	}

	dispose() {
		this.#clearCountdown();
		this.#unsub?.();
		this.#unsub = null;
		this.#source.dispose();
		this.status = 'idle';
	}
}

export const player = new PlayerStore();
