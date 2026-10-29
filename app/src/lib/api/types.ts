/**
 * TypeScript model for every backend protobuf message.
 *
 * Field names are VERBATIM from `crates/oskol-core/proto/pmodel.proto` and
 * `clientbin.proto` (the wire names), per the JSON rules in docs/design.md:
 *  - defaults are always emitted (absent scalars -> 0 / "" / false,
 *    absent repeated -> [], absent messages -> null),
 *  - ints are JSON numbers, bytes are base64 strings,
 *  - proto `map<K,V>` is a JSON object keyed by the stringified key.
 *
 * Do NOT rename these to camelCase: the core serializes with the proto names.
 */

/** bytes -> base64 string */
export type Bytes = string;

// --- small / shared ------------------------------------------------------

export interface Keyval {
	Key: number;
	Value: string;
}

export interface IntStringPair {
	first: number;
	second: string;
}

export interface PairData {
	From: number;
	To: number;
}

export interface RatingCluster {
	PartOn: PairData | null;
	PartTwo: PairData | null;
}

export interface ids {
	id: number;
	title1: string;
	title2: string;
}

/** person / network / list / recommendation entity */
export interface tti {
	id: number;
	title1: string;
	title2: string;
	img: string;
	title3: string;
}

export interface ItemCounter {
	Country: number;
	Count: number;
}

export interface Relaxation {
	facet: string;
	wouldBe: number;
}

export interface Rating {
	type: number;
	r1: string;
	r2: string;
	uri: string;
}

// --- core content --------------------------------------------------------

export interface GenericTitle {
	id: number;
	persian: string;
	titles: string[];
	Year: number;
	contenttype: number;
	genres: number[];
	country: number[];
	rank: number;
	votes: number;
	img: string;
	contentrating: number;
	MustSee: boolean;
	MetaScore: number;
	UserScore: number;
	TomatoMeter: number;
	Audience: number;
	Description: string;
	LatestChange: string;
	Language: number;
	Tags: Keyval[];
	BgColor: string;
	isDub: boolean;
	S: string;
	E: string;
	Q: string;
	orgtitles: string[];
}

export interface GetMore {
	items: GenericTitle[];
	hasmove: boolean;
	total: number;
	relaxations: Relaxation[];
	relaxed: string[];
}

export interface HomeEntity {
	id: number;
	title: string;
	type: number;
	hasmore: boolean;
	moreendpoint: string;
	recently: GenericTitle[];
}

export interface Home {
	sections: HomeEntity[];
	hasmove: boolean;
}

export interface ItemDetail {
	country: number;
	language: number[];
	genre: number[];
	category: ids[];
	runtime: number;
	network: tti[];
	airday: number;
	creator: tti[];
	director: tti[];
	people: tti[];
	recommended: tti[];
	comment: string;
	rating: Rating[];
	ListingRank: tti[];
	MustSee: boolean;
	status: number;
	hasbg: boolean;
	trailer: string;
	tServer: number;
	tUrl: string;
	message: string[];
	Budget: number;
	Revenue: number;
}

export interface ISearch {
	Titles: GenericTitle[];
	Keywords: ids[];
	People: tti[];
}

// --- files / groups ------------------------------------------------------

export interface File {
	id: number;
	urn: string;
	description: string;
	adaptive: boolean;
	SoftSub: boolean;
	Download: boolean;
	S: string;
	E: string;
	Color: number;
	Title: string[];
	Size: number;
	ExtraInfo: string[];
	Social: boolean;
	vurn: string;
	LS: boolean;
	isDub: boolean;
	LSI: string;
	DSTF: boolean;
}

/** Identical shape to File (proto FileV2). */
export type FileV2 = File;

export interface GroupInfo {
	Title: string[];
	Child: GroupInfo[];
	Files: File[];
	Color: number;
	Downloadable: boolean;
	x265: boolean;
	Description: string;
	FilesCount: number;
	ExtraInfo: string[];
}

export interface GroupInfoV2 {
	Title: string[];
	Child: GroupInfoV2[];
	Files: FileV2[];
	Color: number;
	Downloadable: boolean;
	x265: boolean;
	Description: string;
	FilesCount: number;
	ExtraInfo: string[];
	id: number;
	SoftSub: boolean;
	isDub: boolean;
	isOriginal: boolean;
	isCensored: boolean;
	isHDR: boolean;
	isDts: boolean;
	isDolbyVision: boolean;
	SceenSize: number;
	avgSize: number;
	S: string;
	LatestE: string;
	ColorIndicator: Bytes;
}

export interface LongArray {
	group_ids: number[];
}

export interface TitleFiles {
	Items: GroupInfo | null;
	Downloadable: boolean;
	MultiGroup: boolean;
	Banner: boolean;
}

export interface TitleFilesV2 {
	Items: GroupInfoV2 | null;
	Downloadable: boolean;
	GroupInfo: boolean;
	Banner: boolean;
	InfoMap: Record<string, LongArray>;
}

// --- filters -------------------------------------------------------------

export interface AdvanceFiler {
	PublishYear: PairData | null;
	Genres: number[];
	Imdb: RatingCluster | null;
	Meta: RatingCluster | null;
	Rotten: RatingCluster | null;
	MDL: RatingCluster | null;
	Mal: RatingCluster | null;
	Dizi: RatingCluster | null;
	Countries: number[];
	Violence: PairData | null;
	Profanity: PairData | null;
	Drugs: PairData | null;
	Frightening: PairData | null;
	Sort: number;
	type: number;
	contentType: number;
	checksum: number;
	genreMatch: number;
	ratingMatch: number;
}

// --- auth / session ------------------------------------------------------

export interface OAuth {
	status: boolean;
	birth: boolean;
	contentType: number;
	id: number;
	plan: number;
	carry: string;
	Name: string;
	Family: string;
	IsGetter: boolean;
	IsWacher: boolean;
	Age: number;
	Vip: boolean;
	VipLevel: number;
}

export interface Ctype {
	items: ids[];
}

export interface Faq {
	items: ids[];
}

// --- preload / config ----------------------------------------------------

export interface PreLoad {
	revision: number;
	genre: string[];
	seriesstatus: string[];
	contentratingtext: string[];
	contentrating: string[];
	countries: string[];
	languages: string[];
	listingcolors: string[];
	ColorPalette: number[];
	AndroidCellVersionCode: number;
	AndroidCellMinVersionCode: number;
	AndroidCellUpdate: ids[];
	AndroidCellChangeLog: string[];
	Envs: string;
	BotUrl: string;
	IsPrivate: boolean;
	Salt: Bytes;
	inUsecountries: ItemCounter[];
	Lists: tti[];
	SearchTypeFilter: tti[];
	Banner: boolean;
	LatestNonForceUpdateAndroidCellVersionCode: number;
	AdsInterval: number;
	HideTvEmailAuth: boolean;
	HideTvGoogleAuth: boolean;
	ns: string;
	EnableProxyForIR: boolean;
	EnableProxyForNonIR: boolean;
	BannerForIR: boolean;
	EnableGuestLogin: boolean;
	GuestNotice: boolean;
}

// --- ads / account -------------------------------------------------------

export interface adProfile {
	TodayAds: number;
	Today: boolean;
	DayMinus1: boolean;
	DayMinus2: boolean;
	DayMinus3: boolean;
	Coins: number;
	adAssignments: number;
	IReq: number;
	IRes: number;
	NextADSneedVPN: boolean;
	NextADSavailable: boolean;
	AdsLast7Days: number;
	AdsLast14Days: number;
	AdsLast21Days: number;
	DayMinus4: boolean;
	DayMinus5: boolean;
	DayMinus6: boolean;
	DayMinus7: boolean;
	Vip: boolean;
	VipLevel: number;
}

// --- sync ----------------------------------------------------------------

export interface WatchDataType {
	id: number;
	fid: number;
	length: number;
	last: number;
	on: number;
}

export interface SyncStuff {
	Watches: WatchDataType[];
	Likes: WatchDataType[];
}

export interface CheckSumDataType {
	id: number;
	Last: number;
	sum: number;
}

export interface CheckSum {
	items: CheckSumDataType[];
}

export interface DynamicMessage {
	Status: boolean;
	Message: string;
	Messages: string[];
	values: number[];
}

// --- player carry --------------------------------------------------------

export interface PlayerCarry {
	FilesIndex: Record<string, number>;
	Files: IntStringPair[];
	PlayebleIndex: number;
	PlayebleItems: FileV2[];
	Title: GenericTitle | null;
}

// --- subtitles (clientbin.proto) -----------------------------------------

export interface SubtitleITems {
	Owner: number;
	Deaf: boolean;
	Link: string;
	Fps: number;
	Language: number;
	Keys: string[];
}

export interface SubTitleParent {
	Status: boolean;
	Items: SubtitleITems[];
}
