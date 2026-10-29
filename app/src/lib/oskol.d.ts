/**
 * Ambient typing for the `window.oskol` bridge exposed by the Electron preload
 * (electron/preload/index.ts, owned by Worker A). The renderer talks to the core
 * ONLY through this surface. Keep this in sync with the preload's contextBridge.
 */

export interface CoreEndpoint {
	port: number;
	token: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	level: LogLevel;
	scope: string;
	code?: string;
	message: string;
	ts: number;
	[extra: string]: unknown;
}

export interface OskolBridge {
	/** `{ port, token }` for the local core RPC server. */
	coreEndpoint(): CoreEndpoint;
	openExternal(url: string): void | Promise<void>;
	clipboardWrite(text: string): void | Promise<void>;
	saveFile(name: string, data: Uint8Array | ArrayBuffer | string): Promise<string | null>;
	pickFile(): Promise<string | null>;
	/** Append a structured entry to the local app log file. */
	log(entry: LogEntry): void | Promise<void>;
	/** Native menu Back/Forward. Returns an unsubscribe function. */
	onNav(cb: (dir: 'back' | 'forward') => void): () => void;
	/** External media players detected on the host (for "open in…"). */
	players: ExternalPlayer[];
	/** Launch a (local /stream) URL in a detected external player. */
	openInPlayer(playerId: string, url: string): Promise<boolean>;
	/** Start a streamed download of `url` to `destDir` (a group folder) or the app's
	 *  default downloads dir; resolves the download id. */
	download(url: string, filename: string, destDir?: string): Promise<string>;
	/** Abort an in-flight download (by the id from `download`) and delete its partial file. */
	cancelDownload(id: string): Promise<void>;
	/** Subscribe to download progress/terminal events. Returns an unsubscribe fn. */
	onDownloadProgress(cb: (p: DownloadProgress) => void): () => void;
	platform: string;
	appVersion: string;
}

/** A single download progress / terminal event from the main process. */
export interface DownloadProgress {
	id: string;
	received: number;
	total: number;
	state: 'active' | 'done' | 'error' | 'canceled';
	/** absolute on-disk path, present on the terminal `done` event */
	path?: string;
}

export interface ExternalPlayer {
	id: string;
	name: string;
}

declare global {
	interface Window {
		oskol?: OskolBridge;
	}
}

export {};
