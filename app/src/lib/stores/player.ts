/**
 * Player store (minimal for Phase 1). Holds the currently-loaded playback intent
 * and chrome state. Real playback (libmpv/<video>) is wired in a later phase;
 * for now this tracks what the /player route should present.
 */
import { create } from 'zustand';
import type { GenericTitle, FileV2 } from '../api/types';

export interface PlayerSource {
	/** resolved stream URL from playUrl(), if any */
	url?: string;
	filename?: string;
	urn?: string;
	title?: GenericTitle | null;
	file?: FileV2 | null;
}

export interface PlayerState {
	source: PlayerSource | null;
	playing: boolean;
	position: number;
	duration: number;
	volume: number;
	muted: boolean;
	rate: number;
	fullscreen: boolean;
	setSource: (s: PlayerSource | null) => void;
	setPlaying: (v: boolean) => void;
	setPosition: (v: number) => void;
	setDuration: (v: number) => void;
	setVolume: (v: number) => void;
	setMuted: (v: boolean) => void;
	setRate: (v: number) => void;
	setFullscreen: (v: boolean) => void;
	reset: () => void;
}

const INITIAL = {
	source: null as PlayerSource | null,
	playing: false,
	position: 0,
	duration: 0,
	volume: 1,
	muted: false,
	rate: 1,
	fullscreen: false
};

export const usePlayerStore = create<PlayerState>((set) => ({
	...INITIAL,
	setSource: (source) => set({ source, position: 0 }),
	setPlaying: (playing) => set({ playing }),
	setPosition: (position) => set({ position }),
	setDuration: (duration) => set({ duration }),
	setVolume: (volume) => set({ volume }),
	setMuted: (muted) => set({ muted }),
	setRate: (rate) => set({ rate }),
	setFullscreen: (fullscreen) => set({ fullscreen }),
	reset: () => set(INITIAL)
}));
