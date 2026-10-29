/**
 * The PlaybackSource seam. Phase 1 ships the full player CHROME wired to a
 * StubPlaybackSource that just advances a timeline. A real backend (libmpv /
 * <video>) implements `PlaybackSource` and is dropped into the controller; no
 * UI code changes.
 */
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
