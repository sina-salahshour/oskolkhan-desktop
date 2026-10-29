/**
 * API entrypoint. Picks the real Tauri client or the mock implementation.
 *
 * Selection order:
 *  - VITE_MOCK forces the choice: '1'/'true' -> mock, '0'/'false' -> real (Tauri).
 *  - running inside a Tauri webview -> the real Tauri client.
 *  - VITE_BROWSER=1 (browser mode: `pnpm browser`) -> the HTTP client, which
 *    talks to the live core over `…/<token>/rpc` (see http.ts / serve.rs).
 *  - otherwise the mock (e.g. `vite dev` in a plain browser).
 */
import type { OskolApi } from './api';
import { mockClient } from './mock';
import { tauriClient } from './client';
import { httpClient } from './http';

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
	if (hasTauri()) return tauriClient;
	if (import.meta.env.VITE_BROWSER === '1') return httpClient;
	return mockClient;
}

export const api: OskolApi = selectApi();

export type { OskolApi } from './api';
export type { SearchArgs, LikeArgs, WatchArgs, SubtitleArgs, GetMoreArgs } from './api';
export * from './contract';
export * from './types';
