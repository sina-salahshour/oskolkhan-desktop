/**
 * ThemeProvider: applies the UI store's theme to <html>. It sets BOTH a `.dark`
 * class (for the Tailwind v4 dark variant) and `data-theme="dark|light"` (for
 * CSS that keys off the attribute). When theme === 'system' it follows the OS
 * and re-applies on change. Worker A's CSS must respond to `.dark` / data-theme.
 */
import { useEffect, type ReactNode } from 'react';
import { useUiStore, resolveTheme } from '../lib/stores/ui';

function apply(resolved: 'dark' | 'light') {
	if (typeof document === 'undefined') return;
	const el = document.documentElement;
	el.classList.toggle('dark', resolved === 'dark');
	el.classList.toggle('light', resolved === 'light');
	el.dataset.theme = resolved;
	el.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const theme = useUiStore((s) => s.theme);

	useEffect(() => {
		apply(resolveTheme(theme));
		if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia('(prefers-color-scheme: light)');
		const onChange = () => apply(resolveTheme('system'));
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, [theme]);

	return <>{children}</>;
}
