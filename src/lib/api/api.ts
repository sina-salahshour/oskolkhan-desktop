/**
 * The typed API surface. Both the real Tauri client (client.ts) and the mock
 * (mock.ts) implement `OskolApi`. Screens depend only on this interface.
 */
import type { CoreStatus, Session, TelegramStart } from './contract';
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
	Ctype,
	AdvanceFiler
} from './types';

export interface SearchArgs {
	phrase: string;
	type: number;
	ignoreTypes: number[];
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
	filter?: Partial<AdvanceFiler>;
}

export interface OskolApi {
	/** True when talking to a real Tauri backend; false for the mock layer. */
	readonly isMock: boolean;

	// --- core status ---
	coreStatus(): Promise<CoreStatus>;
	/** Subscribe to `core://status`. Returns an unsubscribe function. */
	onStatus(cb: (status: CoreStatus) => void): () => void;
	importKickstart(path: string): Promise<CoreStatus>;
	retryBoot(): Promise<CoreStatus>;

	// --- data ops ---
	preload(): Promise<PreLoad>;
	home(page: number): Promise<Home>;
	getMore(args: GetMoreArgs): Promise<GetMore>;
	item(id: number): Promise<GenericTitle>;
	itemDetail(id: number): Promise<ItemDetail>;
	files(id: number): Promise<TitleFilesV2>;
	faq(): Promise<Faq>;
	search(args: SearchArgs): Promise<ISearch>;
	likes(type: number, page: number): Promise<GetMore>;
	watches(type: number, page: number): Promise<GetMore>;
	removeWatch(tid: number): Promise<void>;
	like(args: LikeArgs): Promise<void>;
	watch(args: WatchArgs): Promise<void>;
	subtitles(args: SubtitleArgs): Promise<SubTitleParent>;
	srt(path: string): Promise<string>;
	trailer(lsi: string, urn: string): Promise<string>;
	adProfile(): Promise<adProfile>;
	getContentTypes(): Promise<Ctype>;
	setContentTypes(value: number): Promise<Session>;
	setBirth(value: string): Promise<Session>;

	// --- auth ---
	authEmail(userName: string, password: string): Promise<Session>;
	authGuest(): Promise<Session>;
	authGoogle(): Promise<Session>;
	authTelegramStart(): Promise<TelegramStart>;
	authTelegramPoll(): Promise<Session | null>;
	session(): Promise<Session | null>;
	logout(): Promise<void>;
}
