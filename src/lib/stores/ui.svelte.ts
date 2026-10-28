/**
 * UI/preferences store: theme, command palette, and user-facing settings that
 * the Settings screen edits. Persisted to localStorage per viewer.
 */
import { browser } from '$app/env';

export type Theme = 'dark' | 'light';
export type TitleLang = 'persian' | 'original';
export type ViewMode = 'grid' | 'list' | 'poster';
export type BufferProfile = 'low' | 'balanced' | 'high';

export interface SubtitleDefaults {
	font: string;
	size: number;
	position: number; // 0..100 from bottom
	edge: 'none' | 'outline' | 'drop' | 'raised';
	background: number; // 0..100 opacity
	color: string;
}

interface Persisted {
	theme: Theme;
	titleLang: TitleLang;
	movieView: ViewMode;
	seriesView: ViewMode;
	buffer: BufferProfile;
	subtitle: SubtitleDefaults;
}

const KEY = 'oskol:ui';

const DEFAULTS: Persisted = {
	theme: 'dark',
	titleLang: 'persian',
	movieView: 'poster',
	seriesView: 'poster',
	buffer: 'balanced',
	subtitle: {
		font: 'Vazirmatn',
		size: 100,
		position: 8,
		edge: 'outline',
		background: 35,
		color: '#ffffff'
	}
};

function load(): Persisted {
	if (!browser) return structuredClone(DEFAULTS);
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return { ...structuredClone(DEFAULTS), ...(JSON.parse(raw) as Partial<Persisted>) };
	} catch {
		/* ignore */
	}
	return structuredClone(DEFAULTS);
}

class UiStore {
	#p = load();

	theme = $state<Theme>(this.#p.theme);
	titleLang = $state<TitleLang>(this.#p.titleLang);
	movieView = $state<ViewMode>(this.#p.movieView);
	seriesView = $state<ViewMode>(this.#p.seriesView);
	buffer = $state<BufferProfile>(this.#p.buffer);
	subtitle = $state<SubtitleDefaults>(this.#p.subtitle);

	// transient UI state
	paletteOpen = $state(false);
	sidebarCollapsed = $state(false);

	persist() {
		if (!browser) return;
		const data: Persisted = {
			theme: this.theme,
			titleLang: this.titleLang,
			movieView: this.movieView,
			seriesView: this.seriesView,
			buffer: this.buffer,
			subtitle: this.subtitle
		};
		try {
			localStorage.setItem(KEY, JSON.stringify(data));
		} catch {
			/* ignore */
		}
	}

	applyTheme() {
		if (!browser) return;
		document.documentElement.dataset.theme = this.theme;
	}

	setTheme(theme: Theme) {
		this.theme = theme;
		this.applyTheme();
		this.persist();
	}

	toggleTheme() {
		this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
	}

	openPalette() {
		this.paletteOpen = true;
	}

	closePalette() {
		this.paletteOpen = false;
	}

	togglePalette() {
		this.paletteOpen = !this.paletteOpen;
	}
}

export const ui = new UiStore();
