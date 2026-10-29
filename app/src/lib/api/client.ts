/**
 * The single RPC client. It is the ONLY place that talks to the core's
 * `POST /rpc` endpoint. The endpoint `{ port, token }` comes from the Electron
 * preload via `window.oskol.coreEndpoint()`.
 *
 *   base   = http://127.0.0.1:${port}
 *   POST     ${base}/rpc
 *   header   x-oskol-token: ${token}
 *   body     { command, args }
 *   200   -> body is the command's JSON        (resolve)
 *   non-2xx -> body is { code, message }        (reject with it)
 *
 * All failures become `{ code, message }` with codes:
 *   notReady | network | auth | server | decode | unimplemented
 */
import type {
	CoreStatus,
	Session,
	TelegramStart,
	SearchArgs,
	LikeArgs,
	WatchArgs,
	SubtitleArgs,
	GetMoreArgs,
	PlayUrlArgs,
	PlayUrlResult,
	ApiError
} from './contract';
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

function err(code: ApiError['code'], message: string): Promise<never> {
	return Promise.reject({ code, message } satisfies ApiError);
}

function endpoint(): { base: string; token: string } | null {
	const bridge = typeof window !== 'undefined' ? window.oskol : undefined;
	if (!bridge) return null;
	try {
		const { port, token } = bridge.coreEndpoint();
		if (!port) return null;
		return { base: `http://127.0.0.1:${port}`, token };
	} catch {
		return null;
	}
}

/** POST one JSON-RPC command and resolve with its JSON (or reject with {code,message}). */
export async function rpc<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
	const ep = endpoint();
	if (!ep) return err('notReady', `rpc ${command}: core endpoint unavailable`);

	let res: Response;
	try {
		res = await fetch(`${ep.base}/rpc`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-oskol-token': ep.token },
			body: JSON.stringify({ command, args })
		});
	} catch (e) {
		return err('network', `rpc ${command} failed: ${e instanceof Error ? e.message : String(e)}`);
	}

	if (!res.ok) {
		let body: unknown = null;
		try {
			body = await res.json();
		} catch {
			/* non-JSON error body */
		}
		if (body && typeof body === 'object' && 'code' in body) {
			return Promise.reject(body as ApiError);
		}
		const code: ApiError['code'] =
			res.status === 401 || res.status === 403
				? 'auth'
				: res.status === 501
					? 'unimplemented'
					: res.status >= 500
						? 'server'
						: 'network';
		return err(code, `rpc ${command} failed (${res.status})`);
	}

	const text = await res.text();
	try {
		return (text ? JSON.parse(text) : null) as T;
	} catch (e) {
		return err('decode', `rpc ${command}: bad JSON (${e instanceof Error ? e.message : String(e)})`);
	}
}

/** Generic `api(op, args)` bridge — wraps the backend's `{command:"api", args:{op,args}}`. */
function apiOp<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
	return rpc<T>('api', { op, args });
}

/** Fully typed client. Every command and every `api` op has a wrapper here. */
export const client = {
	// --- lifecycle / status ---
	coreStatus: () => rpc<CoreStatus>('core_status'),
	importKickstart: (path: string) => rpc<CoreStatus>('import_kickstart', { path }),

	// --- data ops (via api(op,args)) ---
	preload: () => apiOp<PreLoad>('preload'),
	home: (page: number) => apiOp<Home>('home', { page }),
	getMore: (args: GetMoreArgs) => apiOp<GetMore>('getMore', { ...args }),
	item: (id: number) => apiOp<GenericTitle>('item', { id }),
	itemDetail: (id: number) => apiOp<ItemDetail>('itemDetail', { id }),
	files: (id: number) => apiOp<TitleFilesV2>('files', { id }),
	faq: () => apiOp<Faq>('faq'),
	search: (args: SearchArgs) => apiOp<ISearch>('search', { ...args }),
	likes: (type: number, page: number) => apiOp<GetMore>('likes', { type, page }),
	watches: (type: number, page: number) => apiOp<GetMore>('watches', { type, page }),
	removeWatch: (tid: number) => apiOp<null>('removeWatch', { tid }),
	like: (args: LikeArgs) => apiOp<null>('like', { ...args }),
	watch: (args: WatchArgs) => apiOp<null>('watch', { ...args }),
	subtitles: (args: SubtitleArgs) => apiOp<SubTitleParent>('subtitles', { ...args }),
	srt: (path: string) => apiOp<string>('srt', { path }),
	trailer: (lsi: string, urn: string) => apiOp<string>('trailer', { lsi, urn }),
	playUrl: (args: PlayUrlArgs) => apiOp<PlayUrlResult>('playUrl', { ...args }),
	adProfile: () => apiOp<adProfile>('adProfile'),
	getContentTypes: () => apiOp<Ctype>('getContentTypes'),
	setContentTypes: (value: number) => apiOp<Session>('setContentTypes', { value }),
	setBirth: (value: string) => apiOp<Session>('setBirth', { value }),

	// --- auth / session ---
	authEmail: (userName: string, password: string) =>
		rpc<Session>('auth_email', { userName, password }),
	authGuest: () => rpc<Session>('auth_guest'),
	authGoogle: () => rpc<Session>('auth_google'),
	authTelegramStart: () => rpc<TelegramStart>('auth_telegram_start'),
	authTelegramPoll: () => rpc<Session | null>('auth_telegram_poll'),
	session: () => rpc<Session | null>('session'),
	logout: () => rpc<void>('logout')
};

export type ApiClient = typeof client;
