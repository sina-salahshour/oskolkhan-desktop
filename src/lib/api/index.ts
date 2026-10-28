/**
 * API entrypoint. Picks the real Tauri client or the mock implementation.
 *
 * Mock is used when:
 *  - the build flag VITE_MOCK=1 is set, or
 *  - the app is not running inside a Tauri webview (e.g. `vite dev` in a
 *    normal browser, or the static mock build opened directly).
 */
import type { OskolApi } from './api';
import { mockClient } from './mock';
import { tauriClient } from './client';

function hasTauri(): boolean {
	if (typeof window === 'undefined') return false;
	const w = window as unknown as Record<string, unknown>;
	// Tauri v2 injects these globals into the webview.
	return '__TAURI_INTERNALS__' in w || '__TAURI__' in w;
}

function selectApi(): OskolApi {
	const forced = import.meta.env.VITE_MOCK;
	if (forced === '1' || forced === 'true') return mockClient;
	if (forced === '0' || forced === 'false') return tauriClient;
	return hasTauri() ? tauriClient : mockClient;
}

export const api: OskolApi = selectApi();

export type { OskolApi } from './api';
export type { SearchArgs, LikeArgs, WatchArgs, SubtitleArgs, GetMoreArgs } from './api';
export * from './contract';
export * from './types';
