/**
 * i18n entry point. The reactive store lives in `store.svelte.ts` because Svelte 5
 * runes ($state) are only allowed in `.svelte` / `.svelte.ts` modules. This file
 * re-exports it so existing `$lib/i18n` imports keep working.
 */
export { i18n, t } from './store.svelte';
export type { Lang } from './strings';
