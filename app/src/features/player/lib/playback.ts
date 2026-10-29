/**
 * The PlaybackSource seam. Phase 1 ships the full player CHROME wired to a
 * StubPlaybackSource that just advances a timeline. A real backend (libmpv /
 * <video>) implements `PlaybackSource` and is dropped into the controller; no
 * UI code changes.
 */
import Hls from 'hls.js';
import type { FileV2, GenericTitle } from '../../../lib/api/types';

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
	/** set only with status 'error' */
	errorKind?: 'unsupported' | 'network' | 'generic';
}

export function buildStreamUrl(assetBase: string, file: FileV2): string {
	return `${assetBase}/stream?urn=${encodeURIComponent(file.urn)}&id=${file.id}`;
}

/** The core `/hls/open` endpoint: probes + starts the ffmpeg HLS session. */
export function buildHlsOpenUrl(assetBase: string, file: FileV2): string {
	return `${assetBase}/hls/open?urn=${encodeURIComponent(file.urn)}&id=${file.id}`;
}

/** Track metadata the HLS source discovers from ffprobe, for the chrome store. */
export interface PlaybackAudioTrack {
	id: string;
	label: string;
	lang: string | null;
}
export interface PlaybackSubtitleTrack {
	id: string;
	label: string;
	lang: string | null;
	source: 'server' | 'embedded';
}
export interface PlaybackMeta {
	duration: number;
	audioTracks: PlaybackAudioTrack[];
	subtitleTracks: PlaybackSubtitleTrack[];
}

export interface PlaybackSource {
	readonly kind: 'stub' | 'html5' | 'hls' | 'mpv';
	load(req: PlaybackRequest): Promise<void>;
	play(): void;
	pause(): void;
	seek(seconds: number): void;
	setRate(rate: number): void;
	setVolume(v01: number): void;
	dispose(): void;
	subscribe(cb: (state: PlaybackState) => void): () => void;
	/** Real audio/subtitle tracks + total duration, once `load` resolved (HLS only). */
	meta?(): PlaybackMeta | null;
}

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const IDLE: PlaybackState = { status: 'idle', currentTime: 0, duration: 0, buffered: 0 };

/** Fake timeline so the chrome is fully interactive without a real decoder. */
export class StubPlaybackSource implements PlaybackSource {
	readonly kind = 'stub' as const;
	private state: PlaybackState = { ...IDLE };
	private subs = new Set<(s: PlaybackState) => void>();
	private timer: ReturnType<typeof setInterval> | null = null;
	private loadTimer: ReturnType<typeof setTimeout> | null = null;
	private rate = 1;
	private disposed = false;

	private emit(next: Partial<PlaybackState>): void {
		this.state = { ...this.state, ...next };
		for (const cb of this.subs) cb(this.state);
	}

	async load(req: PlaybackRequest): Promise<void> {
		this.stop();
		this.emit({ status: 'loading', currentTime: req.startAt ?? 0, buffered: 0 });
		const duration = 60 * (90 + Math.floor(Math.random() * 40));
		await new Promise<void>((resolve) => {
			this.loadTimer = setTimeout(resolve, 400);
		});
		this.loadTimer = null;
		if (this.disposed) return;
		this.emit({ status: 'paused', duration, buffered: (req.startAt ?? 0) + 30 });
	}

	play(): void {
		if (this.state.status === 'ended') this.emit({ currentTime: 0 });
		this.emit({ status: 'playing' });
		this.tick();
	}

	pause(): void {
		this.emit({ status: this.state.status === 'playing' ? 'paused' : this.state.status });
		this.stop();
	}

	seek(seconds: number): void {
		const t = Math.max(0, Math.min(seconds, this.state.duration));
		this.emit({ currentTime: t, buffered: Math.min(this.state.duration, t + 30) });
	}

	setRate(rate: number): void {
		this.rate = rate;
	}

	setVolume(_v01: number): void {
		/* stub: volume handled in UI only */
		void _v01;
	}

	dispose(): void {
		this.disposed = true;
		this.stop();
		if (this.loadTimer) clearTimeout(this.loadTimer);
		this.subs.clear();
		this.state = { ...IDLE };
	}

	subscribe(cb: (s: PlaybackState) => void): () => void {
		this.subs.add(cb);
		cb(this.state);
		return () => {
			this.subs.delete(cb);
		};
	}

	private tick(): void {
		this.stop();
		if (typeof window === 'undefined') return;
		this.timer = setInterval(() => {
			if (this.state.status !== 'playing') return;
			const next = this.state.currentTime + this.rate;
			if (next >= this.state.duration) {
				this.emit({ currentTime: this.state.duration, status: 'ended' });
				this.stop();
			} else {
				this.emit({ currentTime: next, buffered: Math.min(this.state.duration, next + 30) });
			}
		}, 1000);
	}

	private stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}

/** Real playback through an HTMLVideoElement fed by the local asset-server stream proxy. */
export class Html5PlaybackSource implements PlaybackSource {
	readonly kind = 'html5' as const;
	private state: PlaybackState = { ...IDLE };
	private subs = new Set<(s: PlaybackState) => void>();
	private disposed = false;
	private pendingStart = 0;
	private readonly listeners: Array<[string, () => void]> = [];

	constructor(
		private readonly video: HTMLVideoElement,
		private readonly assetBase: string,
	) {
		const on = (type: string, fn: () => void) => {
			video.addEventListener(type, fn);
			this.listeners.push([type, fn]);
		};
		const meta = () => {
			const d = Number.isFinite(video.duration) ? video.duration : 0;
			this.emit({ duration: d });
		};
		on('loadedmetadata', meta);
		on('durationchange', meta);
		on('timeupdate', () => this.emit({ currentTime: video.currentTime }));
		on('progress', () => this.emit({ buffered: this.bufferedEnd() }));
		on('playing', () => this.emit({ status: 'playing', errorKind: undefined }));
		on('pause', () => {
			if (!video.ended) this.emit({ status: 'paused' });
		});
		on('waiting', () => this.emit({ status: 'loading' }));
		on('ended', () => this.emit({ status: 'ended', currentTime: video.currentTime }));
		on('error', () => this.emit({ status: 'error', errorKind: this.classifyError() }));
	}

	private emit(next: Partial<PlaybackState>): void {
		if (this.disposed) return;
		this.state = { ...this.state, ...next };
		if (next.status && next.status !== 'error') delete this.state.errorKind;
		for (const cb of this.subs) cb(this.state);
	}

	private bufferedEnd(): number {
		const b = this.video.buffered;
		const t = this.video.currentTime;
		for (let i = 0; i < b.length; i++) {
			if (t >= b.start(i) && t <= b.end(i) + 0.5) return b.end(i);
		}
		return b.length ? b.end(b.length - 1) : 0;
	}

	private classifyError(): 'unsupported' | 'network' | 'generic' {
		const code = this.video.error?.code;
		if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_DECODE) return 'unsupported';
		if (code === MediaError.MEDIA_ERR_NETWORK) return 'network';
		return 'generic';
	}

	load(req: PlaybackRequest): Promise<void> {
		const file = req.file;
		this.pendingStart = req.startAt ?? 0;
		if (!file) {
			this.emit({ status: 'error', errorKind: 'generic' });
			return Promise.resolve();
		}
		const v = this.video;
		this.emit({ status: 'loading', currentTime: this.pendingStart, buffered: 0, duration: 0 });
		return new Promise<void>((resolve) => {
			const done = () => {
				v.removeEventListener('loadedmetadata', onReady);
				v.removeEventListener('canplay', onReady);
				v.removeEventListener('error', done);
				resolve();
			};
			const onReady = () => {
				if (this.pendingStart > 0) {
					try {
						v.currentTime = this.pendingStart;
					} catch {
						/* ignore */
					}
					this.pendingStart = 0;
				}
				if (!this.disposed) this.emit({ status: v.paused ? 'paused' : 'playing' });
				done();
			};
			v.addEventListener('loadedmetadata', onReady);
			v.addEventListener('canplay', onReady);
			v.addEventListener('error', done);
			v.src = buildStreamUrl(this.assetBase, file);
			v.load();
		});
	}

	play(): void {
		if (this.state.status === 'ended') this.video.currentTime = 0;
		this.video.play().catch(() => undefined);
	}

	pause(): void {
		this.video.pause();
	}

	seek(seconds: number): void {
		const d = Number.isFinite(this.video.duration) ? this.video.duration : this.state.duration;
		this.video.currentTime = Math.max(0, d > 0 ? Math.min(seconds, d) : seconds);
	}

	setRate(rate: number): void {
		this.video.playbackRate = rate;
	}

	setVolume(v01: number): void {
		const v = Math.max(0, Math.min(1, v01));
		this.video.muted = v === 0;
		this.video.volume = v;
	}

	dispose(): void {
		this.disposed = true;
		for (const [type, fn] of this.listeners) this.video.removeEventListener(type, fn);
		this.listeners.length = 0;
		this.video.pause();
		this.video.removeAttribute('src');
		this.video.load();
		this.subs.clear();
		this.state = { ...IDLE };
	}

	subscribe(cb: (s: PlaybackState) => void): () => void {
		this.subs.add(cb);
		cb(this.state);
		return () => {
			this.subs.delete(cb);
		};
	}
}

interface HlsOpenResponse {
	playlist: string;
	duration: number;
	audioTracks?: PlaybackAudioTrack[];
	subtitleTracks?: PlaybackSubtitleTrack[];
}

/**
 * Playback of arbitrary containers/codecs (MKV, HEVC, AC3/DTS, …) via the core's
 * on-the-fly HLS transcoder. `load` hits `/hls/open` (which probes + starts
 * ffmpeg), then hls.js plays the resulting fMP4 playlist in the <video> element.
 * Total duration + real track lists come from the open response (the growing
 * event playlist only knows what has been transcoded so far).
 */
export class HlsPlaybackSource implements PlaybackSource {
	readonly kind = 'hls' as const;
	private state: PlaybackState = { ...IDLE };
	private subs = new Set<(s: PlaybackState) => void>();
	private disposed = false;
	private pendingStart = 0;
	private totalDuration = 0;
	private lastMeta: PlaybackMeta | null = null;
	private hls: Hls | null = null;
	private readonly listeners: Array<[string, () => void]> = [];

	constructor(
		private readonly video: HTMLVideoElement,
		/** Read lazily at load time — the asset base can change (core restart /
		 *  status refresh) without this source needing to be torn down. */
		private readonly getAssetBase: () => string,
	) {
		const on = (type: string, fn: () => void) => {
			video.addEventListener(type, fn);
			this.listeners.push([type, fn]);
		};
		on('timeupdate', () => this.emit({ currentTime: this.video.currentTime }));
		on('progress', () => this.emit({ buffered: this.bufferedEnd() }));
		on('playing', () => this.emit({ status: 'playing', errorKind: undefined }));
		on('pause', () => {
			if (!this.video.ended) this.emit({ status: 'paused' });
		});
		on('waiting', () => this.emit({ status: 'loading' }));
		on('ended', () => this.emit({ status: 'ended', currentTime: this.video.currentTime }));
		on('error', () => {
			// A native <video> error that isn't surfaced via hls.js (rare).
			if (this.video.error) this.emit({ status: 'error', errorKind: 'generic' });
		});
	}

	meta(): PlaybackMeta | null {
		return this.lastMeta;
	}

	private emit(next: Partial<PlaybackState>): void {
		if (this.disposed) return;
		// Keep the authoritative total duration from /hls/open, not the growing
		// event-playlist duration the <video> element would otherwise report.
		if (this.totalDuration > 0) next = { ...next, duration: this.totalDuration };
		this.state = { ...this.state, ...next };
		if (next.status && next.status !== 'error') delete this.state.errorKind;
		for (const cb of this.subs) cb(this.state);
	}

	private bufferedEnd(): number {
		const b = this.video.buffered;
		const t = this.video.currentTime;
		for (let i = 0; i < b.length; i++) {
			if (t >= b.start(i) && t <= b.end(i) + 0.5) return b.end(i);
		}
		return b.length ? b.end(b.length - 1) : 0;
	}

	private teardownHls(): void {
		if (this.hls) {
			this.hls.destroy();
			this.hls = null;
		}
	}

	async load(req: PlaybackRequest): Promise<void> {
		const file = req.file;
		this.pendingStart = req.startAt ?? 0;
		this.teardownHls();
		if (!file) {
			this.emit({ status: 'error', errorKind: 'generic' });
			return;
		}
		this.emit({ status: 'loading', currentTime: this.pendingStart, buffered: 0, duration: 0 });

		const assetBase = this.getAssetBase();
		let open: HlsOpenResponse;
		try {
			const res = await fetch(buildHlsOpenUrl(assetBase, file));
			if (!res.ok) throw new Error(`hls open ${res.status}`);
			open = (await res.json()) as HlsOpenResponse;
		} catch (e) {
			console.error('[hls] open failed', e);
			if (!this.disposed) this.emit({ status: 'error', errorKind: 'network' });
			return;
		}
		if (this.disposed) return;

		this.totalDuration = open.duration || 0;
		this.lastMeta = {
			duration: open.duration || 0,
			audioTracks: open.audioTracks ?? [],
			subtitleTracks: open.subtitleTracks ?? [],
		};
		// Surface the real duration right away (even before playback starts) so the
		// scrub bar isn't stuck at --:--.
		this.emit({ status: 'loading', duration: this.totalDuration });

		let playlistUrl: string;
		let hls: Hls;
		try {
			// The open `playlist` is a root-absolute path including the token; resolve
			// it against the asset origin.
			playlistUrl = new URL(open.playlist, assetBase).href;
			if (!Hls.isSupported()) {
				this.emit({ status: 'error', errorKind: 'unsupported' });
				return;
			}
			hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 30 });
			this.hls = hls;
		} catch (e) {
			console.error('[hls] setup failed', e);
			this.emit({ status: 'error', errorKind: 'generic' });
			return;
		}
		const v = this.video;

		return new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				resolve();
			};
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				if (this.disposed) return;
				if (this.pendingStart > 0) {
					try {
						v.currentTime = this.pendingStart;
					} catch {
						/* ignore */
					}
					this.pendingStart = 0;
				}
				this.emit({ status: v.paused ? 'paused' : 'playing' });
				finish();
			});
			hls.on(Hls.Events.ERROR, (_e, data) => {
				if (!data.fatal) return;
				console.error('[hls] fatal', data.type, data.details, data.reason ?? '');
				const kind =
					data.type === Hls.ErrorTypes.NETWORK_ERROR
						? 'network'
						: data.type === Hls.ErrorTypes.MEDIA_ERROR
							? 'unsupported'
							: 'generic';
				if (!this.disposed) this.emit({ status: 'error', errorKind: kind });
				finish();
			});
			try {
				hls.loadSource(playlistUrl);
				hls.attachMedia(v);
			} catch (e) {
				console.error('[hls] loadSource failed', e);
				if (!this.disposed) this.emit({ status: 'error', errorKind: 'generic' });
				finish();
			}
		});
	}

	play(): void {
		if (this.state.status === 'ended') this.video.currentTime = 0;
		this.video.play().catch(() => undefined);
	}

	pause(): void {
		this.video.pause();
	}

	seek(seconds: number): void {
		const d = this.totalDuration > 0 ? this.totalDuration : this.video.duration;
		this.video.currentTime = Math.max(0, Number.isFinite(d) && d > 0 ? Math.min(seconds, d) : seconds);
	}

	setRate(rate: number): void {
		this.video.playbackRate = rate;
	}

	setVolume(v01: number): void {
		const v = Math.max(0, Math.min(1, v01));
		this.video.muted = v === 0;
		this.video.volume = v;
	}

	dispose(): void {
		this.disposed = true;
		this.teardownHls();
		for (const [type, fn] of this.listeners) this.video.removeEventListener(type, fn);
		this.listeners.length = 0;
		this.video.pause();
		this.video.removeAttribute('src');
		this.video.load();
		this.subs.clear();
		this.state = { ...IDLE };
		this.lastMeta = null;
	}

	subscribe(cb: (s: PlaybackState) => void): () => void {
		this.subs.add(cb);
		cb(this.state);
		return () => {
			this.subs.delete(cb);
		};
	}
}
