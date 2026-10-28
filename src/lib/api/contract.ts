/**
 * The UI <-> core contract from docs/design.md.
 * These are the shapes of the Tauri command boundary, distinct from the raw
 * protobuf messages in types.ts.
 */

export type CorePhase = 'starting' | 'bootstrapping' | 'ready' | 'offline' | 'error';

export interface CoreStatus {
	phase: CorePhase;
	message: string | null;
	activeHost: string | null;
	routes: number;
	/** e.g. "http://127.0.0.1:43123/<token>" */
	assetBase: string;
	loggedIn: boolean;
}

/** The session projection the core exposes (derived from OAuth). */
export interface Session {
	id: number;
	name: string;
	family: string;
	vip: boolean;
	vipLevel: number;
	plan: number;
	contentType: number;
	needsBirth: boolean;
	needsContentType: boolean;
}

export type ApiErrorCode = 'notReady' | 'network' | 'auth' | 'server' | 'decode' | 'unimplemented';

export interface ApiError {
	code: ApiErrorCode;
	message: string;
}

/** Type guard for the rejected-promise error shape. */
export function isApiError(e: unknown): e is ApiError {
	return (
		typeof e === 'object' &&
		e !== null &&
		'code' in e &&
		typeof (e as { code: unknown }).code === 'string'
	);
}

/** The `op` names accepted by the generic `api(op, args)` command. */
export type ApiOp =
	| 'preload'
	| 'home'
	| 'getMore'
	| 'item'
	| 'itemDetail'
	| 'files'
	| 'faq'
	| 'search'
	| 'likes'
	| 'watches'
	| 'removeWatch'
	| 'like'
	| 'watch'
	| 'subtitles'
	| 'srt'
	| 'trailer'
	| 'adProfile'
	| 'getContentTypes'
	| 'setContentTypes'
	| 'setBirth';

export interface AuthEmailArgs {
	userName: string;
	password: string;
}

export interface TelegramStart {
	botUrl: string;
}
