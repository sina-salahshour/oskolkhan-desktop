/**
 * Feature-local settings store for preferences the foundation `ui` store does
 * NOT own: title language, movie/series view modes, buffer profile and subtitle
 * defaults. Theme + interface language live in the foundation `ui` store; these
 * are the remaining persisted app preferences. Persisted to localStorage.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TitleLang = 'persian' | 'original';
export type ViewMode = 'grid' | 'list' | 'poster';
export type BufferProfile = 'low' | 'balanced' | 'high';
export type SubtitleEdge = 'none' | 'outline' | 'drop' | 'raised';

export interface SubtitleDefaults {
	font: string;
	/** percent, 50-200 */
	size: number;
	/** 0-100 (vertical position) */
	position: number;
	edge: SubtitleEdge;
	/** background opacity 0-100 */
	background: number;
	color: string;
}

export interface SettingsState {
	titleLang: TitleLang;
	movieView: ViewMode;
	seriesView: ViewMode;
	buffer: BufferProfile;
	subtitle: SubtitleDefaults;
	setTitleLang: (v: TitleLang) => void;
	setMovieView: (v: ViewMode) => void;
	setSeriesView: (v: ViewMode) => void;
	setBuffer: (v: BufferProfile) => void;
	setSubtitle: (patch: Partial<SubtitleDefaults>) => void;
}

export const useSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			titleLang: 'persian',
			movieView: 'grid',
			seriesView: 'grid',
			buffer: 'balanced',
			subtitle: { font: 'Vazirmatn', size: 100, position: 10, edge: 'outline', background: 0, color: '#ffffff' },
			setTitleLang: (titleLang) => set({ titleLang }),
			setMovieView: (movieView) => set({ movieView }),
			setSeriesView: (seriesView) => set({ seriesView }),
			setBuffer: (buffer) => set({ buffer }),
			setSubtitle: (patch) => set((s) => ({ subtitle: { ...s.subtitle, ...patch } }))
		}),
		{ name: 'oskol.settings' }
	)
);
