/**
 * Real API client: talks to the Rust core through Tauri commands.
 * Command names and payloads are exactly those defined in docs/design.md.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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

/** Generic `api(op, args)` bridge. */
function api<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
	return invoke<T>('api', { op, args });
}

export const tauriClient: OskolApi = {
	isMock: false,

	coreStatus() {
		return invoke<CoreStatus>('core_status');
	},
	onStatus(cb) {
		const unlisten = listen<CoreStatus>('core://status', (event) => cb(event.payload));
		let cancelled = false;
		unlisten.then((fn) => {
			if (cancelled) fn();
		});
		return () => {
			cancelled = true;
			unlisten.then((fn) => fn());
		};
	},
	importKickstart(path) {
		return invoke<CoreStatus>('import_kickstart', { path });
	},
	retryBoot() {
		// TODO(core): no retry command is defined in the contract yet; the core
		// worker needs a `retry_boot` command that re-runs bootstrap.
		return invoke<CoreStatus>('retry_boot');
	},

	preload() {
		return api<PreLoad>('preload');
	},
	home(page) {
		return api<Home>('home', { page });
	},
	getMore(args: GetMoreArgs) {
		return api<GetMore>('getMore', { ...args });
	},
	item(id) {
		return api<GenericTitle>('item', { id });
	},
	itemDetail(id) {
		return api<ItemDetail>('itemDetail', { id });
	},
	files(id) {
		return api<TitleFilesV2>('files', { id });
	},
	faq() {
		return api<Faq>('faq');
	},
	search(args: SearchArgs) {
		return api<ISearch>('search', { ...args });
	},
	likes(type, page) {
		return api<GetMore>('likes', { type, page });
	},
	watches(type, page) {
		return api<GetMore>('watches', { type, page });
	},
	async removeWatch(tid) {
		await api<null>('removeWatch', { tid });
	},
	async like(args: LikeArgs) {
		await api<null>('like', { ...args });
	},
	async watch(args: WatchArgs) {
		await api<null>('watch', { ...args });
	},
	subtitles(args: SubtitleArgs) {
		return api<SubTitleParent>('subtitles', { ...args });
	},
	srt(path) {
		return api<string>('srt', { path });
	},
	trailer(lsi, urn) {
		return api<string>('trailer', { lsi, urn });
	},
	adProfile() {
		return api<adProfile>('adProfile');
	},
	getContentTypes() {
		return api<Ctype>('getContentTypes');
	},
	setContentTypes(value) {
		return api<Session>('setContentTypes', { value });
	},
	setBirth(value) {
		return api<Session>('setBirth', { value });
	},

	authEmail(userName, password) {
		return invoke<Session>('auth_email', { userName, password });
	},
	authGuest() {
		return invoke<Session>('auth_guest');
	},
	authGoogle() {
		return invoke<Session>('auth_google');
	},
	authTelegramStart() {
		return invoke<TelegramStart>('auth_telegram_start');
	},
	authTelegramPoll() {
		return invoke<Session | null>('auth_telegram_poll');
	},
	session() {
		return invoke<Session | null>('session');
	},
	async logout() {
		await invoke<void>('logout');
	}
};
