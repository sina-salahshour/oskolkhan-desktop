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
	platform: string;
	appVersion: string;
}

declare global {
	interface Window {
		oskol?: OskolBridge;
	}
}

export {};
