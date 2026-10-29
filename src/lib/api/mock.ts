/**
 * Mock API implementation. Lets every screen be browsed with no backend.
 * Auto-selected when not running under Tauri, or when VITE_MOCK=1.
 */
import type { CoreStatus, Session, TelegramStart } from './contract';
import type { OskolApi, SearchArgs, LikeArgs, WatchArgs, SubtitleArgs, GetMoreArgs } from './api';
import type { GetMore } from './types';
import {
	makeHome,
	makeGetMore,
	titleById,
	makeItemDetail,
	makeFiles,
	makeFaq,
	makeSearch,
	makeAdProfile,
	makeCtype,
	makeSubtitles,
	makePreLoad,
	TITLES
} from './fixtures';

const MOCK_ASSET_BASE = 'http://127.0.0.1:43123/mocktoken';
const SESSION_KEY = 'oskol:mock:session';

function delay<T>(value: T, ms = 320): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// --- simulated core boot -------------------------------------------------

let status: CoreStatus = {
	phase: 'starting',
	message: 'در حال آماده‌سازی هسته',
	activeHost: null,
	routes: 0,
	assetBase: MOCK_ASSET_BASE,
	loggedIn: false
};

const listeners = new Set<(s: CoreStatus) => void>();
let bootStarted = false;

function emit(next: Partial<CoreStatus>) {
	status = { ...status, ...next };
	for (const cb of listeners) cb(status);
}

function loadSession(): Session | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		return raw ? (JSON.parse(raw) as Session) : null;
	} catch {
		return null;
	}
}

function saveSession(s: Session | null) {
	try {
		if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
		else localStorage.removeItem(SESSION_KEY);
	} catch {
		/* ignore (private mode / blocked storage) */
	}
}

let currentSession: Session | null = loadSession();

function runBoot() {
	if (bootStarted) return;
	bootStarted = true;
	emit({ phase: 'starting', message: 'راه‌اندازی هسته', routes: 0 });
	setTimeout(() => {
		emit({ phase: 'bootstrapping', message: 'دریافت مسیرها از منابع کیک‌استارت' });
	}, 420);
	setTimeout(() => {
		emit({
			phase: 'ready',
			message: null,
			activeHost: 'edge05.556512.ir.cdn.ir',
			routes: 6,
			loggedIn: currentSession != null
		});
	}, 1150);
}

const GUEST: Session = {
	id: 0,
	name: 'مهمان',
	family: '',
	vip: false,
	vipLevel: 0,
	plan: 0,
	contentType: 1,
	needsBirth: false,
	needsContentType: false
};

function demoSession(name: string, family: string): Session {
	return {
		id: 90125,
		name,
		family,
		vip: true,
		vipLevel: 2,
		plan: 1,
		contentType: 1,
		needsBirth: false,
		needsContentType: false
	};
}

function setSession(s: Session | null) {
	currentSession = s;
	saveSession(s);
	emit({ loggedIn: s != null });
}

let telegramPolls = 0;

export const mockClient: OskolApi = {
	isMock: true,

	coreStatus() {
		runBoot();
		return delay(status, 60);
	},
	onStatus(cb) {
		listeners.add(cb);
		runBoot();
		// deliver current state asynchronously so subscribers see it
		queueMicrotask(() => cb(status));
		return () => listeners.delete(cb);
	},
	importKickstart() {
		emit({ phase: 'bootstrapping', message: 'در حال خواندن فایل کیک‌استارت' });
		return new Promise((resolve) => {
			setTimeout(() => {
				emit({
					phase: 'ready',
					message: null,
					activeHost: 'imported.osbin',
					routes: 7,
					loggedIn: currentSession != null
				});
				resolve(status);
			}, 700);
		});
	},
	retryBoot() {
		bootStarted = false;
		runBoot();
		return delay(status, 60);
	},

	preload: () => delay(makePreLoad()),
	home: (page) => delay(makeHome(), page > 1 ? 400 : 260),
	getMore: (args: GetMoreArgs) => delay<GetMore>(makeGetMore(args.endpoint, args.page)),
	item: (id) => delay(titleById(id)),
	itemDetail: (id) => delay(makeItemDetail(id)),
	files: (id) => delay(makeFiles(id)),
	faq: () => delay(makeFaq()),
	search: (args: SearchArgs) => delay(makeSearch(args.phrase)),
	likes: (_type, page) =>
		delay<GetMore>(
			{
				items: TITLES.slice(0, 8),
				hasmove: false,
				total: 8,
				relaxations: [],
				relaxed: []
			},
			page > 1 ? 400 : 240
		),
	watches: (_type, page) =>
		delay<GetMore>(
			{
				items: TITLES.slice(2, 9),
				hasmove: false,
				total: 7,
				relaxations: [],
				relaxed: []
			},
			page > 1 ? 400 : 240
		),
	removeWatch: () => delay(undefined, 180),
	like: (_args: LikeArgs) => delay(undefined, 180),
	watch: (_args: WatchArgs) => delay(undefined, 120),
	subtitles: (_args: SubtitleArgs) => delay(makeSubtitles()),
	srt: () =>
		delay(
			'1\n00:00:01,000 --> 00:00:04,000\nنمونه زیرنویس فارسی\n\n2\n00:00:05,000 --> 00:00:08,000\nخط دوم زیرنویس',
			200
		),
	playUrl: (args) =>
		delay({
			url: `http://mock.local:1221/stream/${args.urn || 'file'}.mp4`,
			filename: `${(args.urn || 'file').split('/').pop()}.mp4`
		}),
	trailer: () => delay('mock://trailer.mp4'),
	adProfile: () => delay(makeAdProfile()),
	getContentTypes: () => delay(makeCtype()),
	setContentTypes: (value) => {
		if (currentSession)
			setSession({ ...currentSession, contentType: value, needsContentType: false });
		return delay(currentSession ?? GUEST);
	},
	setBirth: () => {
		if (currentSession) setSession({ ...currentSession, needsBirth: false });
		return delay(currentSession ?? GUEST);
	},

	authEmail: (userName) => {
		const s = demoSession(userName.split('@')[0] || 'کاربر', '');
		setSession(s);
		return delay(s, 600);
	},
	authGuest: () => {
		setSession(GUEST);
		return delay(GUEST, 400);
	},
	authGoogle: () => {
		const s = demoSession('کاربر', 'گوگل');
		setSession(s);
		return delay(s, 700);
	},
	authTelegramStart: () => {
		telegramPolls = 0;
		return delay<TelegramStart>(
			{ botUrl: 'https://t.me/OskolKhanBot?start=register-mock1234' },
			300
		);
	},
	authTelegramPoll: () => {
		telegramPolls += 1;
		if (telegramPolls < 3) return delay<Session | null>(null, 400);
		const s = demoSession('کاربر', 'تلگرام');
		setSession(s);
		return delay<Session | null>(s, 400);
	},
	session: () => delay(currentSession, 100),
	logout: () => {
		setSession(null);
		return delay(undefined, 200);
	}
};
