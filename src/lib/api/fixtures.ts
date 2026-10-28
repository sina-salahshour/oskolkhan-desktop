/**
 * Mock fixtures, shaped exactly like the backend protobuf -> JSON contract.
 * Every message factory fills all proto defaults (0 / "" / false / [] / null)
 * so the fixtures are valid against types.ts and exercise the real UI paths.
 */
import type {
	PreLoad,
	Home,
	HomeEntity,
	GenericTitle,
	GetMore,
	ItemDetail,
	TitleFilesV2,
	GroupInfoV2,
	FileV2,
	Faq,
	ISearch,
	adProfile,
	Ctype,
	Rating,
	tti,
	ids,
	SubTitleParent
} from './types';

// --- preload lookups -----------------------------------------------------

export const GENRES = [
	'اکشن',
	'ماجراجویی',
	'انیمیشن',
	'کمدی',
	'جنایی',
	'مستند',
	'درام',
	'خانوادگی',
	'فانتزی',
	'تاریخی',
	'ترسناک',
	'موزیکال',
	'معمایی',
	'عاشقانه',
	'علمی‌تخیلی',
	'هیجان‌انگیز',
	'جنگی',
	'وسترن'
];

export const COUNTRIES = [
	'آمریکا',
	'انگلستان',
	'فرانسه',
	'کره جنوبی',
	'ژاپن',
	'ایران',
	'ترکیه',
	'آلمان',
	'اسپانیا',
	'کانادا',
	'هند',
	'ایتالیا'
];

export const LANGUAGES = [
	'انگلیسی',
	'فارسی',
	'کره‌ای',
	'ژاپنی',
	'فرانسوی',
	'اسپانیایی',
	'آلمانی',
	'ترکی'
];

export const CONTENT_RATING_TEXT = ['همه سنین', '+۷', '+۱۳', '+۱۶', '+۱۸'];

export const LISTING_COLORS = ['#e8b23a', '#4fa3ff', '#ff6b6b', '#38c172', '#a78bfa', '#f472b6'];

function emptyGenericTitle(): GenericTitle {
	return {
		id: 0,
		persian: '',
		titles: [],
		Year: 0,
		contenttype: 0,
		genres: [],
		country: [],
		rank: 0,
		votes: 0,
		img: '',
		contentrating: 0,
		MustSee: false,
		MetaScore: 0,
		UserScore: 0,
		TomatoMeter: 0,
		Audience: 0,
		Description: '',
		LatestChange: '',
		Language: 0,
		Tags: [],
		BgColor: '',
		isDub: false,
		S: '',
		E: '',
		Q: '',
		orgtitles: []
	};
}

function title(p: Partial<GenericTitle>): GenericTitle {
	return { ...emptyGenericTitle(), ...p };
}

// --- title catalogue -----------------------------------------------------

export const TITLES: GenericTitle[] = [
	title({
		id: 101,
		persian: 'تلألو',
		titles: ['Oppenheimer'],
		orgtitles: ['Oppenheimer'],
		Year: 2023,
		contenttype: 1,
		genres: [6, 9, 15],
		country: [0, 1],
		rank: 8.3,
		votes: 742310,
		img: '/oppenheimer',
		contentrating: 3,
		MustSee: true,
		MetaScore: 90,
		UserScore: 8.1,
		TomatoMeter: 93,
		Audience: 91,
		Description:
			'داستان رابرت اوپنهایمر، فیزیک‌دانی که نقش محوری در ساخت نخستین بمب اتمی داشت و بار اخلاقی این دستاورد را تا پایان عمر با خود حمل کرد.',
		Language: 0,
		BgColor: '#2a1a12',
		Q: '4K HDR'
	}),
	title({
		id: 102,
		persian: 'تل‌ماسه: بخش دوم',
		titles: ['Dune: Part Two'],
		orgtitles: ['Dune: Part Two'],
		Year: 2024,
		contenttype: 1,
		genres: [1, 8, 14],
		country: [0],
		rank: 8.5,
		votes: 512904,
		img: '/dune2',
		contentrating: 2,
		MustSee: true,
		MetaScore: 79,
		UserScore: 8.6,
		TomatoMeter: 92,
		Audience: 95,
		Description:
			'پل اتریدیس در کنار چانی و فرمن‌ها دست به قیام می‌زند تا انتقام نابودی خاندانش را بگیرد و با سرنوشتی که از آن می‌گریزد روبه‌رو شود.',
		Language: 0,
		BgColor: '#1c1710',
		Q: '4K DV'
	}),
	title({
		id: 103,
		persian: 'بازی مرکب',
		titles: ['Squid Game'],
		orgtitles: ['오징어 게임'],
		Year: 2021,
		contenttype: 2,
		genres: [0, 6, 15],
		country: [3],
		rank: 8.0,
		votes: 489201,
		img: '/squidgame',
		contentrating: 4,
		MetaScore: 69,
		UserScore: 8.0,
		Description:
			'صدها بازیکن بدهکار برای جایزه‌ای کلان در بازی‌هایی کودکانه اما مرگبار شرکت می‌کنند؛ جایی که باخت معنای مرگ می‌دهد.',
		Language: 2,
		isDub: true,
		BgColor: '#201016',
		S: '2',
		E: '7',
		Q: 'x265'
	}),
	title({
		id: 104,
		persian: 'شوگون',
		titles: ['Shōgun'],
		orgtitles: ['Shōgun'],
		Year: 2024,
		contenttype: 2,
		genres: [1, 6, 9],
		country: [0, 4],
		rank: 8.7,
		votes: 201455,
		img: '/shogun',
		contentrating: 3,
		MustSee: true,
		MetaScore: 89,
		UserScore: 8.7,
		Description:
			'در ژاپن فئودالی سال ۱۶۰۰، ناخدایی انگلیسی در میان کشمکش‌های خونین اربابان بزرگ گرفتار می‌شود و سرنوشتش به یک ارباب بلندپرواز گره می‌خورد.',
		Language: 3,
		BgColor: '#131a16',
		S: '1',
		E: '10',
		Q: '4K HDR'
	}),
	title({
		id: 105,
		persian: 'بعد از رگبار',
		titles: ['Past Lives'],
		orgtitles: ['Past Lives'],
		Year: 2023,
		contenttype: 1,
		genres: [6, 13],
		country: [0, 3],
		rank: 7.8,
		votes: 128740,
		img: '/pastlives',
		contentrating: 2,
		MetaScore: 94,
		UserScore: 7.8,
		TomatoMeter: 95,
		Audience: 88,
		Description:
			'دو دوست دوران کودکی پس از دو دهه جدایی دوباره یکدیگر را می‌یابند و درباره‌ی سرنوشت، عشق و انتخاب‌هایشان تأمل می‌کنند.',
		Language: 0,
		BgColor: '#101822'
	}),
	title({
		id: 106,
		persian: 'پسران',
		titles: ['The Boys'],
		orgtitles: ['The Boys'],
		Year: 2024,
		contenttype: 2,
		genres: [0, 3, 15],
		country: [0],
		rank: 8.6,
		votes: 612300,
		img: '/theboys',
		contentrating: 4,
		UserScore: 8.6,
		Description:
			'گروهی از افراد عادی در برابر ابرقهرمانانی فاسد می‌ایستند که زیر پوشش یک شرکت قدرتمند هر جنایتی را ماست‌مالی می‌کنند.',
		Language: 0,
		isDub: true,
		BgColor: '#1f1012',
		S: '4',
		E: '8',
		Q: 'x265'
	}),
	title({
		id: 107,
		persian: 'گودزیلا منهای یک',
		titles: ['Godzilla Minus One'],
		orgtitles: ['ゴジラ-1.0'],
		Year: 2023,
		contenttype: 1,
		genres: [0, 1, 6],
		country: [4],
		rank: 7.7,
		votes: 92110,
		img: '/godzilla',
		contentrating: 2,
		MetaScore: 81,
		UserScore: 7.7,
		TomatoMeter: 98,
		Audience: 98,
		Description:
			'ژاپن ویران‌شده‌ی پس از جنگ با تهدیدی تازه و مهیب روبه‌رو می‌شود؛ هیولایی که زخم‌های کهنه را دوباره می‌شکافد.',
		Language: 3,
		BgColor: '#0f1418'
	}),
	title({
		id: 108,
		persian: 'جدایی',
		titles: ['Severance'],
		orgtitles: ['Severance'],
		Year: 2022,
		contenttype: 2,
		genres: [6, 12, 14],
		country: [0],
		rank: 8.7,
		votes: 221870,
		img: '/severance',
		contentrating: 3,
		MustSee: true,
		UserScore: 8.7,
		Description:
			'کارمندانی که خاطرات کاری و شخصی‌شان با جراحی از هم جدا شده، کم‌کم به راز هولناک شرکتی که در آن کار می‌کنند پی می‌برند.',
		Language: 0,
		BgColor: '#0e1526',
		S: '1',
		E: '9'
	}),
	title({
		id: 109,
		persian: 'شهر خاموش',
		titles: ['A Quiet Place: Day One'],
		orgtitles: ['A Quiet Place: Day One'],
		Year: 2024,
		contenttype: 1,
		genres: [10, 15, 6],
		country: [0],
		rank: 6.8,
		votes: 78010,
		img: '/quietplace',
		contentrating: 3,
		UserScore: 6.8,
		TomatoMeter: 86,
		Description: 'نخستین روز هجوم موجوداتی که با صدا شکار می‌کنند، در قلب نیویورک روایت می‌شود.',
		Language: 0,
		BgColor: '#14100e'
	}),
	title({
		id: 110,
		persian: 'آقای رباتی',
		titles: ['Mr. Robot'],
		orgtitles: ['Mr. Robot'],
		Year: 2019,
		contenttype: 2,
		genres: [4, 6, 15],
		country: [0],
		rank: 8.5,
		votes: 410200,
		img: '/mrrobot',
		contentrating: 4,
		UserScore: 8.5,
		Description:
			'هکری منزوی و نابغه جذب گروهی انقلابی می‌شود که قصد دارد بزرگ‌ترین شرکت جهان را فروبپاشد.',
		Language: 0,
		BgColor: '#0c1410',
		S: '4',
		E: '13'
	}),
	title({
		id: 111,
		persian: 'بَرَکه',
		titles: ['The Zone of Interest'],
		orgtitles: ['The Zone of Interest'],
		Year: 2023,
		contenttype: 1,
		genres: [6, 9, 16],
		country: [1, 7],
		rank: 7.4,
		votes: 61230,
		img: '/zoneofinterest',
		contentrating: 3,
		MetaScore: 92,
		UserScore: 7.4,
		Description:
			'زندگی به‌ظاهر آرام فرمانده‌ی یک اردوگاه و خانواده‌اش، تنها دیواری با یکی از سیاه‌ترین جنایت‌های تاریخ فاصله دارد.',
		Language: 4,
		BgColor: '#121810'
	}),
	title({
		id: 112,
		persian: 'سلطان کمدی',
		titles: ['Hacks'],
		orgtitles: ['Hacks'],
		Year: 2024,
		contenttype: 2,
		genres: [3, 6],
		country: [0],
		rank: 8.2,
		votes: 44120,
		img: '/hacks',
		contentrating: 3,
		UserScore: 8.2,
		Description:
			'همکاری پرتنش یک کمدین کهنه‌کار لاس‌وگاسی با نویسنده‌ای جوان، به رابطه‌ای عمیق و پرفرازونشیب بدل می‌شود.',
		Language: 0,
		BgColor: '#1a1222',
		S: '3',
		E: '9'
	})
];

const byId = new Map(TITLES.map((t) => [t.id, t]));

export function titleById(id: number): GenericTitle {
	return byId.get(id) ?? title({ id, persian: 'عنوان ناشناخته', titles: ['Unknown'] });
}

// --- home ----------------------------------------------------------------

function pick(ids: number[]): GenericTitle[] {
	return ids.map((id) => titleById(id));
}

export function makeHome(): Home {
	const continueWatching = pick([103, 106, 108]).map((t, i) =>
		title({ ...t, S: t.S || '1', E: String(2 + i) })
	);
	const sections: HomeEntity[] = [
		{
			id: 1,
			title: 'ویژه',
			type: 0, // hero carousel
			hasmore: false,
			moreendpoint: '',
			recently: pick([102, 101, 104, 106])
		},
		{
			id: 2,
			title: 'ادامه تماشا',
			type: 1, // continue watching
			hasmore: false,
			moreendpoint: '',
			recently: continueWatching
		},
		{
			id: 3,
			title: 'پرطرفدارترین‌های این هفته',
			type: 2,
			hasmore: true,
			moreendpoint: 'trending',
			recently: pick([102, 104, 106, 108, 101, 110])
		},
		{
			id: 4,
			title: 'فیلم‌های برگزیده',
			type: 2,
			hasmore: true,
			moreendpoint: 'top-movies',
			recently: pick([101, 105, 107, 109, 111])
		},
		{
			id: 5,
			title: 'سریال‌هایی که باید دید',
			type: 2,
			hasmore: true,
			moreendpoint: 'must-see-series',
			recently: pick([104, 108, 103, 110, 112, 106])
		},
		{
			id: 6,
			title: 'تازه‌های هفته',
			type: 2,
			hasmore: true,
			moreendpoint: 'new',
			recently: pick([102, 109, 112, 107])
		}
	];
	return { sections, hasmove: false };
}

export function makeGetMore(endpoint: string, page: number): GetMore {
	const pool = TITLES;
	const perPage = 12;
	const start = (Math.max(1, page) - 1) * perPage;
	const items: GenericTitle[] = [];
	for (let i = 0; i < perPage; i++) {
		const base = pool[(start + i) % pool.length];
		items.push(title({ ...base, id: base.id * 100 + page * 10 + i }));
	}
	const total = perPage * 5;
	const hasmove = start + perPage < total;
	const relaxed = endpoint.includes('filter') && page === 1 ? ['rating.imdb', 'year'] : [];
	return {
		items,
		hasmove,
		total,
		relaxations: relaxed.length
			? [
					{ facet: 'rating.imdb', wouldBe: 143 },
					{ facet: 'year', wouldBe: 58 }
				]
			: [],
		relaxed
	};
}

// --- item detail ---------------------------------------------------------

function person(id: number, name: string, role: string, img = ''): tti {
	return { id, title1: name, title2: role, img, title3: '' };
}

function rating(type: number, r1: string, r2: string, uri = ''): Rating {
	return { type, r1, r2, uri };
}

export function makeItemDetail(id: number): ItemDetail {
	const t = titleById(id);
	return {
		country: t.country[0] ?? 0,
		language: t.genres.length ? [t.Language] : [t.Language],
		genre: t.genres,
		category: t.genres.map<ids>((g, i) => ({ id: g, title1: GENRES[g] ?? '', title2: String(i) })),
		runtime: t.contenttype === 2 ? 52 : 166,
		network: [person(1, t.contenttype === 2 ? 'HBO' : 'Universal', 'شبکه')],
		airday: 5,
		creator: [person(10, 'نویسنده‌ی خلاق', 'خالق اثر')],
		director: [person(20, 'کارگردان برجسته', 'کارگردان')],
		people: [
			person(30, 'بازیگر نقش اول', 'شخصیت اصلی'),
			person(31, 'بازیگر نقش دوم', 'همراه'),
			person(32, 'بازیگر مکمل', 'آنتاگونیست'),
			person(33, 'بازیگر مهمان', 'مهمان'),
			person(34, 'بازیگر جوان', 'نقش فرعی'),
			person(35, 'بازیگر کهنه‌کار', 'راوی')
		],
		recommended: [104, 108, 102, 106, 110, 101]
			.filter((rid) => rid !== id)
			.slice(0, 5)
			.map((rid) => {
				const r = titleById(rid);
				return person(r.id, r.persian, String(r.Year), r.img);
			}),
		comment: 'یکی از بهترین آثار سال‌های اخیر از نگاه منتقدان.',
		rating: [
			rating(1, String(t.rank.toFixed(1)), `${(t.votes / 1000).toFixed(0)}K`, 'imdb'),
			rating(2, String(Math.round(t.MetaScore)), '100', 'metacritic'),
			rating(3, String(t.TomatoMeter), '%', 'rotten'),
			rating(4, String(t.Audience), '%', 'audience')
		],
		ListingRank: [person(1, 'رتبه ۱۲ IMDb', 'پرفروش هفته')],
		MustSee: t.MustSee,
		status: t.contenttype === 2 ? 1 : 2,
		hasbg: true,
		trailer: 'mock-trailer',
		tServer: 1,
		tUrl: 'mock://trailer',
		message: [],
		Budget: t.contenttype === 1 ? 100000000 : 0,
		Revenue: t.contenttype === 1 ? 950000000 : 0
	};
}

// --- files (GroupInfoV2 tree) --------------------------------------------

function emptyFileV2(): FileV2 {
	return {
		id: 0,
		urn: '',
		description: '',
		adaptive: false,
		SoftSub: false,
		Download: true,
		S: '',
		E: '',
		Color: 0,
		Title: [],
		Size: 0,
		ExtraInfo: [],
		Social: false,
		vurn: '',
		LS: false,
		isDub: false,
		LSI: '',
		DSTF: false
	};
}

function file(p: Partial<FileV2>): FileV2 {
	return { ...emptyFileV2(), ...p };
}

function emptyGroup(): GroupInfoV2 {
	return {
		Title: [],
		Child: [],
		Files: [],
		Color: 0,
		Downloadable: true,
		x265: false,
		Description: '',
		FilesCount: 0,
		ExtraInfo: [],
		id: 0,
		SoftSub: false,
		isDub: false,
		isOriginal: false,
		isCensored: false,
		isHDR: false,
		isDts: false,
		isDolbyVision: false,
		SceenSize: 0,
		avgSize: 0,
		S: '',
		LatestE: '',
		ColorIndicator: ''
	};
}

function group(p: Partial<GroupInfoV2>): GroupInfoV2 {
	return { ...emptyGroup(), ...p };
}

function qualityFiles(base: string, n: number, dub: boolean, softsub: boolean): FileV2[] {
	return Array.from({ length: n }, (_, i) =>
		file({
			id: 1000 + i,
			urn: `${base}/ep${i + 1}`,
			vurn: `${base}/ep${i + 1}/thumbs`,
			description: n > 1 ? `قسمت ${i + 1}` : 'فیلم کامل',
			Title: n > 1 ? [`قسمت ${i + 1}`, `Episode ${i + 1}`] : ['نسخه کامل'],
			E: n > 1 ? String(i + 1) : '',
			Size: 1200 + i * 90,
			isDub: dub,
			SoftSub: softsub,
			ExtraInfo: ['AVC', '۵.۱ کانال']
		})
	);
}

export function makeFiles(id: number): TitleFilesV2 {
	const t = titleById(id);
	const series = t.contenttype === 2;
	const epCount = series ? Number(t.E || '8') : 1;

	const root = group({
		id,
		Title: [t.persian, t.titles[0] ?? ''],
		Downloadable: true,
		FilesCount: epCount * 3,
		Child: [
			group({
				id: id * 10 + 1,
				Title: ['۴K Ultra HD', '2160p'],
				Color: 0,
				isHDR: true,
				isDolbyVision: t.Q.includes('DV'),
				isDts: true,
				x265: true,
				SceenSize: 2160,
				avgSize: 4800,
				ExtraInfo: ['HEVC', 'Dolby Atmos'],
				LatestE: series ? String(epCount) : '',
				Files: qualityFiles(`${id}/2160`, epCount, false, true)
			}),
			group({
				id: id * 10 + 2,
				Title: ['Full HD', '1080p'],
				Color: 1,
				x265: true,
				SceenSize: 1080,
				avgSize: 1800,
				ExtraInfo: ['x265', '۵.۱'],
				LatestE: series ? String(epCount) : '',
				Files: qualityFiles(`${id}/1080`, epCount, false, true)
			}),
			group({
				id: id * 10 + 3,
				Title: ['دوبله فارسی', 'Dubbed 1080p'],
				Color: 2,
				isDub: true,
				SceenSize: 1080,
				avgSize: 1600,
				ExtraInfo: ['دوبله', 'AAC'],
				LatestE: series ? String(epCount) : '',
				Files: qualityFiles(`${id}/dub`, epCount, true, false)
			}),
			group({
				id: id * 10 + 4,
				Title: ['زیرنویس چسبیده', 'HardSub 720p'],
				Color: 3,
				SoftSub: false,
				SceenSize: 720,
				avgSize: 950,
				ExtraInfo: ['HardSub'],
				LatestE: series ? String(epCount) : '',
				Files: qualityFiles(`${id}/720`, epCount, false, false)
			})
		]
	});

	return {
		Items: root,
		Downloadable: true,
		GroupInfo: true,
		Banner: false,
		InfoMap: {}
	};
}

// --- faq / search / ads / ctype / subtitles ------------------------------

export function makeFaq(): Faq {
	const items: ids[] = [
		{
			id: 1,
			title1: 'چطور حساب VIP بسازم؟',
			title2: 'برای فعال‌سازی VIP کافیست سکه جمع کنید یا از بخش حساب کاربری اقدام کنید.'
		},
		{
			id: 2,
			title1: 'کیفیت پخش را چطور تغییر دهم؟',
			title2: 'در هنگام پخش از منوی تنظیمات کیفیت دلخواه را انتخاب کنید.'
		},
		{
			id: 3,
			title1: 'دانلود چند تکه‌ای چیست؟',
			title2: 'فایل به چند بخش تقسیم و هم‌زمان دانلود می‌شود تا سرعت افزایش یابد.'
		},
		{
			id: 4,
			title1: 'زیرنویس اختصاصی اضافه کنم؟',
			title2: 'از پخش‌کننده، منوی زیرنویس، گزینه بارگذاری فایل محلی را بزنید.'
		},
		{
			id: 5,
			title1: 'چطور زبان رابط را عوض کنم؟',
			title2: 'از بخش تنظیمات، زبان فارسی یا انگلیسی را انتخاب کنید.'
		}
	];
	return { items };
}

export function makeSearch(phrase: string): ISearch {
	const q = phrase.trim().toLowerCase();
	const Titles = q
		? TITLES.filter(
				(t) =>
					t.persian.includes(phrase) ||
					t.titles.some((x) => x.toLowerCase().includes(q)) ||
					t.orgtitles.some((x) => x.toLowerCase().includes(q))
			)
		: TITLES.slice(0, 6);
	const Keywords: ids[] = [
		{ id: 1, title1: 'علمی‌تخیلی', title2: '۱۲۴ عنوان' },
		{ id: 2, title1: 'برنده اسکار', title2: '۸۶ عنوان' },
		{ id: 3, title1: 'دهه ۲۰۲۰', title2: '۳۱۰ عنوان' }
	];
	const People: tti[] = [
		person(301, 'کریستوفر نولان', 'کارگردان'),
		person(302, 'دنی ویلنوو', 'کارگردان'),
		person(303, 'زندایا', 'بازیگر')
	];
	return { Titles: Titles.length ? Titles : [], Keywords, People };
}

export function makeAdProfile(): adProfile {
	return {
		TodayAds: 3,
		Today: true,
		DayMinus1: true,
		DayMinus2: false,
		DayMinus3: true,
		Coins: 1240,
		adAssignments: 5,
		IReq: 12,
		IRes: 11,
		NextADSneedVPN: false,
		NextADSavailable: true,
		AdsLast7Days: 18,
		AdsLast14Days: 33,
		AdsLast21Days: 51,
		DayMinus4: true,
		DayMinus5: false,
		DayMinus6: true,
		DayMinus7: true,
		Vip: true,
		VipLevel: 2
	};
}

export function makeCtype(): Ctype {
	return {
		items: [
			{ id: 0, title1: 'عمومی', title2: 'محتوای خانوادگی' },
			{ id: 1, title1: 'استاندارد', title2: 'اکثر عناوین' },
			{ id: 2, title1: 'کامل', title2: 'همه عناوین' }
		]
	};
}

export function makeSubtitles(): SubTitleParent {
	return {
		Status: true,
		Items: [
			{
				Owner: 1,
				Deaf: false,
				Link: 'mock://fa-1',
				Fps: 23.976,
				Language: 1,
				Keys: ['Farsi', 'فارسی']
			},
			{
				Owner: 2,
				Deaf: false,
				Link: 'mock://fa-2',
				Fps: 25,
				Language: 1,
				Keys: ['Farsi', 'هماهنگ BluRay']
			},
			{
				Owner: 3,
				Deaf: true,
				Link: 'mock://en-1',
				Fps: 23.976,
				Language: 0,
				Keys: ['English', 'SDH']
			}
		]
	};
}

export function makePreLoad(): PreLoad {
	return {
		revision: 44,
		genre: GENRES,
		seriesstatus: ['پایان‌یافته', 'در حال پخش', 'لغو شده', 'به‌زودی'],
		contentratingtext: CONTENT_RATING_TEXT,
		contentrating: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
		countries: COUNTRIES,
		languages: LANGUAGES,
		listingcolors: LISTING_COLORS,
		ColorPalette: [],
		AndroidCellVersionCode: 79,
		AndroidCellMinVersionCode: 70,
		AndroidCellUpdate: [],
		AndroidCellChangeLog: [],
		Envs: 'OskolKhan/2.0.44 ($deviceName; Android $osVersion)',
		BotUrl: 'https://t.me/OskolKhanBot',
		IsPrivate: false,
		Salt: '',
		inUsecountries: [],
		Lists: [],
		SearchTypeFilter: [
			{ id: 0, title1: 'همه', title2: '', img: '', title3: '' },
			{ id: 1, title1: 'فیلم', title2: '', img: '', title3: '' },
			{ id: 2, title1: 'سریال', title2: '', img: '', title3: '' }
		],
		Banner: false,
		LatestNonForceUpdateAndroidCellVersionCode: 75,
		AdsInterval: 300,
		HideTvEmailAuth: false,
		HideTvGoogleAuth: false,
		ns: '',
		EnableProxyForIR: true,
		EnableProxyForNonIR: false,
		BannerForIR: false,
		EnableGuestLogin: true,
		GuestNotice: true
	};
}
