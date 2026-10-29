/**
 * UI store: theme (dark/light/system) and interface language (fa/en), persisted
 * to localStorage. This is the single source of truth for appearance + locale;
 * the ThemeProvider and I18nProvider subscribe to it and apply to <html>.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '../../i18n/strings';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface UiState {
	theme: ThemeMode;
	lang: Lang;
	/** persistent sidebar collapsed state */
	sidebarCollapsed: boolean;
	/** command palette open (Ctrl/Cmd+K) */
	commandOpen: boolean;
	setTheme: (t: ThemeMode) => void;
	toggleTheme: () => void;
	setLang: (l: Lang) => void;
	toggleLang: () => void;
	setSidebarCollapsed: (v: boolean) => void;
	setCommandOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
	persist(
		(set, get) => ({
			theme: 'dark',
			lang: 'fa',
			sidebarCollapsed: false,
			commandOpen: false,
			setTheme: (theme) => set({ theme }),
			toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
			setLang: (lang) => set({ lang }),
			toggleLang: () => set({ lang: get().lang === 'fa' ? 'en' : 'fa' }),
			setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
			setCommandOpen: (commandOpen) => set({ commandOpen })
		}),
		{
			name: 'oskol.ui',
			partialize: (s) => ({ theme: s.theme, lang: s.lang, sidebarCollapsed: s.sidebarCollapsed })
		}
	)
);

/** Resolve a ThemeMode to the concrete 'dark' | 'light' using the OS preference. */
export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
	if (mode !== 'system') return mode;
	if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
	return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const dirForLang = (lang: Lang): 'rtl' | 'ltr' => (lang === 'fa' ? 'rtl' : 'ltr');
