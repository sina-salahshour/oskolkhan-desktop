/**
 * Feature-local player chrome state.
 *
 * NOTE FOR THE INTEGRATOR: the foundation `usePlayerStore` (lib/stores/player)
 * is minimal (phase 1): it only holds source/playing/position/duration/volume/
 * muted/rate/fullscreen. Everything below is EXTENDED chrome state the
 * foundation store lacks, so it lives here: status, buffered, holdingFast, pip,
 * lock, audio/subtitle tracks + selection + style + sync, nextCountdown and the
 * playlist/index. Consider promoting these into the foundation store later.
 */
import { create } from 'zustand';
import type { FileV2 } from '../../lib/api/types';
import type { PlaybackStatus } from './lib/playback';

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
	/** text-based (renderable) vs image-based (can't render). */
	text?: boolean;
	/** Absolute WebVTT URL for the cues (text subs only). */
	vtt?: string | null;
}

export type SubtitleEdge = 'none' | 'outline' | 'drop' | 'raised';

export interface SubtitleStyle {
	font: string;
	/** percentage */
	size: number;
	/** 0..100 from bottom */
	position: number;
	edge: SubtitleEdge;
	/** 0..100 */
	background: number;
	color: string;
}

export interface SubtitleSync {
	delayMs: number;
	fps: number;
	points: { at: number; shift: number }[];
}

export type PanelKind = 'style' | 'sync';

export interface PlayerChromeState {
	status: PlaybackStatus;
	buffered: number;
	playbackErrorKind: 'unsupported' | 'network' | 'generic' | null;
	holdingFast: boolean;
	lock: boolean;
	audioTracks: AudioTrack[];
	audioTrackId: string;
	audioDelayMs: number;
	subtitleTracks: SubtitleTrack[];
	subtitleTrackId: string | null;
	subtitleStyle: SubtitleStyle;
	subtitleSync: SubtitleSync;
	nextCountdown: number | null;
	playlist: FileV2[];
	index: number;
	panel: PanelKind | null;
	/** Storyboard scrub-preview: URL base (…/hls/<sid>), frame spacing (s), count. */
	thumbBase: string | null;
	storyboardInterval: number;
	storyboardCount: number;
	/** HLS playlist URL, for the scrub bar's live-frame preview over loaded ranges. */
	playlistUrl: string | null;

	patch: (p: Partial<Omit<PlayerChromeState, 'patch' | 'patchStyle' | 'patchSync' | 'resetChrome'>>) => void;
	patchStyle: (p: Partial<SubtitleStyle>) => void;
	patchSync: (p: Partial<SubtitleSync>) => void;
	resetChrome: () => void;
}

const INITIAL = {
	status: 'idle' as PlaybackStatus,
	buffered: 0,
	playbackErrorKind: null as 'unsupported' | 'network' | 'generic' | null,
	holdingFast: false,
	lock: false,
	audioTracks: [] as AudioTrack[],
	audioTrackId: '',
	audioDelayMs: 0,
	subtitleTracks: [] as SubtitleTrack[],
	subtitleTrackId: null as string | null,
	subtitleStyle: {
		font: 'Vazirmatn',
		size: 100,
		position: 8,
		edge: 'outline',
		background: 35,
		color: '#ffffff',
	} as SubtitleStyle,
	subtitleSync: { delayMs: 0, fps: 23.976, points: [] } as SubtitleSync,
	nextCountdown: null as number | null,
	playlist: [] as FileV2[],
	index: 0,
	panel: null as PanelKind | null,
	thumbBase: null as string | null,
	storyboardInterval: 10,
	storyboardCount: 0,
	playlistUrl: null as string | null,
};

export const usePlayerChrome = create<PlayerChromeState>((set) => ({
	...INITIAL,
	patch: (p) => set(p),
	patchStyle: (p) => set((s) => ({ subtitleStyle: { ...s.subtitleStyle, ...p } })),
	patchSync: (p) => set((s) => ({ subtitleSync: { ...s.subtitleSync, ...p } })),
	resetChrome: () => set(INITIAL),
}));
