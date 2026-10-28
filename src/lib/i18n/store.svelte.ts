/**
 * Reactive i18n. `i18n.lang` is runes-reactive, so any `t(...)` call inside a
 * component template re-renders when the language changes.
 */
import { dictionaries, type Lang, type Dict } from './strings';

const LANG_KEY = 'oskol:lang';

function initialLang(): Lang {
	if (typeof localStorage !== 'undefined') {
		try {
			const saved = localStorage.getItem(LANG_KEY);
			if (saved === 'fa' || saved === 'en') return saved;
		} catch {
			/* ignore */
		}
	}
	return 'fa';
}

function interpolate(s: string, params?: Record<string, string | number>): string {
	if (!params) return s;
	return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

class I18n {
	lang = $state<Lang>(initialLang());

	get dir(): 'rtl' | 'ltr' {
		return this.lang === 'fa' ? 'rtl' : 'ltr';
	}

	get isRtl(): boolean {
		return this.lang === 'fa';
	}

	private get dict(): Dict {
		return dictionaries[this.lang];
	}

	t = (key: string, params?: Record<string, string | number>): string => {
		const value = this.dict[key] ?? dictionaries.en[key] ?? key;
		return interpolate(value, params);
	};

	setLang(lang: Lang) {
		this.lang = lang;
		try {
			localStorage.setItem(LANG_KEY, lang);
		} catch {
			/* ignore */
		}
		if (typeof document !== 'undefined') {
			document.documentElement.lang = lang;
			document.documentElement.dir = this.dir;
		}
	}

	toggle() {
		this.setLang(this.lang === 'fa' ? 'en' : 'fa');
	}
}

export const i18n = new I18n();

/** Convenience bound translator. */
export const t = i18n.t;
export type { Lang } from './strings';
