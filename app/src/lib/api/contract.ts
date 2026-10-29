/**
 * The renderer <-> core boundary contract (ported from the SvelteKit
 * `src/lib/api/contract.ts`). These are the shapes of the /rpc command boundary,
 * distinct from the raw protobuf messages in types.ts.
 */

export type CorePhase = 'starting' | 'bootstrapping' | 'ready' | 'offline' | 'error';

export interface CoreStatus {
	phase: CorePhase;
	message: string | null;
	activeHost: string | null;
	routes: number;
	/** Base URL of the core's asset server, e.g. "http://127.0.0.1:43123/<token>". */
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

/** Type guard for the rejected-promise error shape produced by the RPC client. */
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
	| 'playUrl'
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

// --- op argument shapes --------------------------------------------------

export interface SearchArgs {
	phrase: string;
	type: number;
	ignoreTypes: number;
	page: number;
}

export interface LikeArgs {
	category: number;
	item: number;
	on: boolean;
	status: number;
}

export interface WatchArgs {
	fid: number;
	tid: number;
	length: number;
	last: number;
	on: number;
}

export interface SubtitleArgs {
	i: number;
	s?: number;
	e?: number;
	c: string;
}

export interface GetMoreArgs {
	endpoint: string;
	page: number;
	/** optional advanced filter payload for explore */
	filter?: Partial<import('./types').AdvanceFiler>;
}

export interface PlayUrlArgs {
	urn: string;
	id?: number;
	vurn?: string;
	download?: boolean;
}

export interface PlayUrlResult {
	url: string;
	filename: string;
}
