/**
 * Tiny i18n layer. Persian-first. `t(key, params)` looks up a flat dotted key in
 * the active dictionary (falling back to English, then the key itself) and
 * interpolates `{name}` placeholders. Direction (rtl/ltr) is derived from the
 * language and applied to <html> by the provider.
 */
import { createContext, useContext, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { dictionaries, type Lang, type Dict } from './strings';
import { useUiStore, dirForLang } from '../lib/stores/ui';

export type TParams = Record<string, string | number>;

export interface I18nValue {
	lang: Lang;
	dir: 'rtl' | 'ltr';
	t: (key: string, params?: TParams) => string;
	setLang: (l: Lang) => void;
	toggleLang: () => void;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(template: string, params?: TParams): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (_, k: string) =>
		k in params ? String(params[k]) : `{${k}}`
	);
}

function translate(dict: Dict, fallback: Dict, key: string, params?: TParams): string {
	const raw = dict[key] ?? fallback[key] ?? key;
	return interpolate(raw, params);
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const lang = useUiStore((s) => s.lang);
	const setLang = useUiStore((s) => s.setLang);
	const toggleLang = useUiStore((s) => s.toggleLang);
	const dir = dirForLang(lang);

	useEffect(() => {
		if (typeof document === 'undefined') return;
		const el = document.documentElement;
		el.lang = lang;
		el.dir = dir;
	}, [lang, dir]);

	const t = useCallback(
		(key: string, params?: TParams) => translate(dictionaries[lang], dictionaries.en, key, params),
		[lang]
	);

	const value = useMemo<I18nValue>(
		() => ({ lang, dir, t, setLang, toggleLang }),
		[lang, dir, t, setLang, toggleLang]
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error('useI18n must be used within <I18nProvider>');
	return ctx;
}

/** Convenience: just the translate function. */
export function useT() {
	return useI18n().t;
}

export { dictionaries } from './strings';
export type { Lang, Dict } from './strings';
