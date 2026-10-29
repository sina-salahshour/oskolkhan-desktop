/**
 * Browser-mode API client: talks to the live Rust core over HTTP JSON-RPC,
 * served by `crates/oskol-core/examples/serve.rs`. Selected when the SPA is built
 * with VITE_BROWSER=1 and opened in a normal browser (Chrome/Chromium) instead of
 * the Tauri WebKitGTK window.
 *
 * The page is served from `…/<token>/`, so the RPC endpoint is `…/<token>/rpc`.
 * The base is derived at runtime from `window.location`: origin + the first path
 * segment (the token). Command names and payloads mirror the Tauri client
 * (client.ts) exactly, so every screen keeps working unchanged.
 *
 * Error convention (matches serve.rs):
 *   - HTTP 200  -> body is the method's JSON (resolve)
 *   - non-2xx   -> body is `{ code, message }` (reject with it, so screens'
 *                  isApiError()/error handling keeps working)
 */
import type { CoreStatus, Session, TelegramStart } from './contract';
import type { OskolApi, SearchArgs, LikeArgs, WatchArgs, SubtitleArgs, GetMoreArgs } from './api';
import type {
	PreLoad,
	Home,
	GetMore,
	GenericTitle,
	ItemDetail,
	TitleFilesV2,
	Faq,
	ISearch,
	SubTitleParent,
	adProfile,
	Ctype
} from './types';

/** The SPA is served at the site root; `/rpc` is same-origin. */
function base(): string {
	return window.location.origin;
}

/** Bridge token, injected into index.html by serve.rs (`window.__OSKOL_BRIDGE_TOKEN__`). */
function token(): string {
	return (window as unknown as { __OSKOL_BRIDGE_TOKEN__?: string }).__OSKOL_BRIDGE_TOKEN__ ?? '';
}

/** POST one JSON-RPC command and resolve with its JSON (or reject with {code,message}). */
async function rpc<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`${base()}/rpc`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-oskol-token': token() },
			body: JSON.stringify({ command, args })
		});
	} catch (e) {
		return Promise.reject({
			code: 'network',
			message: `rpc ${command} failed: ${e instanceof Error ? e.message : String(e)}`
		});
	}
	if (!res.ok) {
		let err: unknown = null;
		try {
			err = await res.json();
		} catch {
			/* non-JSON body */
		}
		if (err && typeof err === 'object' && 'code' in err) return Promise.reject(err);
		return Promise.reject({ code: 'network', message: `rpc ${command} failed (${res.status})` });
	}
	const text = await res.text();
	return (text ? JSON.parse(text) : null) as T;
}

/** Generic `api(op, args)` bridge — same shape as client.ts. */
function apiOp<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
	return rpc<T>('api', { op, args });
}

export const httpClient: OskolApi = {
	isMock: false,

	coreStatus() {
		return rpc<CoreStatus>('core_status');
	},
	onStatus(cb) {
		// No server push: poll core_status and fire the callback on change.
		let last: string | null = null;
		let stopped = false;
		const tick = async () => {
			if (stopped) return;
			try {
				const s = await rpc<CoreStatus>('core_status');
				const key = JSON.stringify(s);
				if (key !== last) {
					last = key;
					cb(s);
				}
			} catch {
				/* transient; next tick retries */
			}
		};
		void tick();
		const id = setInterval(tick, 1500);
		return () => {
			stopped = true;
			clearInterval(id);
		};
	},
	importKickstart(path) {
		return rpc<CoreStatus>('import_kickstart', { path });
	},
	retryBoot() {
		// No dedicated retry command; re-read status so the retry button degrades
		// gracefully (same contract as the Tauri client's fallback).
		return rpc<CoreStatus>('core_status');
	},

	preload() {
		return apiOp<PreLoad>('preload');
	},
	home(page) {
		return apiOp<Home>('home', { page });
	},
	getMore(args: GetMoreArgs) {
		return apiOp<GetMore>('getMore', { ...args });
	},
	item(id) {
		return apiOp<GenericTitle>('item', { id });
	},
	itemDetail(id) {
		return apiOp<ItemDetail>('itemDetail', { id });
	},
	files(id) {
		return apiOp<TitleFilesV2>('files', { id });
	},
	faq() {
		return apiOp<Faq>('faq');
	},
	search(args: SearchArgs) {
		return apiOp<ISearch>('search', { ...args });
	},
	likes(type, page) {
		return apiOp<GetMore>('likes', { type, page });
	},
	watches(type, page) {
		return apiOp<GetMore>('watches', { type, page });
	},
	async removeWatch(tid) {
		await apiOp<null>('removeWatch', { tid });
	},
	async like(args: LikeArgs) {
		await apiOp<null>('like', { ...args });
	},
	async watch(args: WatchArgs) {
		await apiOp<null>('watch', { ...args });
	},
	subtitles(args: SubtitleArgs) {
		return apiOp<SubTitleParent>('subtitles', { ...args });
	},
	srt(path) {
		return apiOp<string>('srt', { path });
	},
	playUrl(args) {
		return apiOp<{ url: string; filename: string }>('playUrl', args);
	},
	trailer(lsi, urn) {
		return apiOp<string>('trailer', { lsi, urn });
	},
	adProfile() {
		return apiOp<adProfile>('adProfile');
	},
	getContentTypes() {
		return apiOp<Ctype>('getContentTypes');
	},
	setContentTypes(value) {
		return apiOp<Session>('setContentTypes', { value });
	},
	setBirth(value) {
		return apiOp<Session>('setBirth', { value });
	},

	authEmail(userName, password) {
		return rpc<Session>('auth_email', { userName, password });
	},
	authGuest() {
		return rpc<Session>('auth_guest');
	},
	authGoogle() {
		return rpc<Session>('auth_google');
	},
	authTelegramStart() {
		return rpc<TelegramStart>('auth_telegram_start');
	},
	authTelegramPoll() {
		return rpc<Session | null>('auth_telegram_poll');
	},
	session() {
		return rpc<Session | null>('session');
	},
	async logout() {
		await rpc<void>('logout');
	}
};
