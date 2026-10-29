/**
 * Mock download engine. The real transfer engine lands in a later phase; until
 * then we seed a believable queue + offline library into the foundation
 * `downloads` store and tick progress forward so the UI has motion to show.
 *
 * We only use the store's public API plus zustand's static `setState` (advancing
 * receivedBytes/speedBps on in-flight items) — the store file itself is untouched.
 */
import { useEffect } from 'react';
import { useDownloadsStore, type DownloadItem } from '@/lib/stores/downloads';

const MB = 1024 * 1024;
const TICK_MS = 800;

let seeded = false;

const SEED: Array<Omit<DownloadItem, 'id' | 'addedAt'>> = [
	{
		titleId: 1372,
		title: 'Dune: Part Two — 2160p HDR',
		urn: 'urn:mock:dune2',
		group: 'Movies 4K',
		sizeBytes: 18_400 * MB,
		receivedBytes: 6_200 * MB,
		speedBps: 6 * MB,
		status: 'downloading'
	},
	{
		titleId: 991,
		title: 'Shōgun · S01E05 — 1080p',
		urn: 'urn:mock:shogun-s01e05',
		group: 'Series',
		sizeBytes: 2_700 * MB,
		receivedBytes: 900 * MB,
		speedBps: 4 * MB,
		status: 'downloading'
	},
	{
		titleId: 455,
		title: 'Oppenheimer — 1080p x265',
		urn: 'urn:mock:oppenheimer',
		group: 'Movies',
		sizeBytes: 4_100 * MB,
		receivedBytes: 1_250 * MB,
		speedBps: 0,
		status: 'paused'
	},
	{
		titleId: 702,
		title: 'The Bear · S03E01 — 1080p',
		urn: 'urn:mock:bear-s03e01',
		group: 'Series',
		sizeBytes: 2_200 * MB,
		receivedBytes: 0,
		speedBps: 0,
		status: 'queued'
	},
	{
		titleId: 310,
		title: 'Spirited Away — 1080p (dub)',
		urn: 'urn:mock:spirited',
		group: 'Movies',
		sizeBytes: 3_600 * MB,
		receivedBytes: 3_600 * MB,
		speedBps: 0,
		status: 'completed'
	},
	{
		titleId: 128,
		title: 'Chernobyl · S01E01 — 1080p',
		urn: 'urn:mock:chernobyl-s01e01',
		group: 'Series',
		sizeBytes: 2_950 * MB,
		receivedBytes: 2_950 * MB,
		speedBps: 0,
		status: 'completed'
	}
];

/** Seed the queue once and run the progress ticker while any item is downloading. */
export function useDownloadsEngine() {
	const add = useDownloadsStore((s) => s.add);

	useEffect(() => {
		if (seeded) return;
		seeded = true;
		if (useDownloadsStore.getState().items.length === 0) {
			for (const s of SEED) add(s);
		}
	}, [add]);

	useEffect(() => {
		const timer = setInterval(() => {
			const { items } = useDownloadsStore.getState();
			if (!items.some((i) => i.status === 'downloading')) return;
			useDownloadsStore.setState((s) => ({
				items: s.items.map((it) => {
					if (it.status !== 'downloading') return it;
					// jitter the speed a little for life-like motion
					const speedBps = Math.max(0.6 * MB, (2.5 + Math.random() * 6) * MB);
					const next = it.receivedBytes + (speedBps * TICK_MS) / 1000;
					if (next >= it.sizeBytes) {
						return { ...it, receivedBytes: it.sizeBytes, speedBps: 0, status: 'completed' };
					}
					return { ...it, receivedBytes: next, speedBps };
				})
			}));
		}, TICK_MS);
		return () => clearInterval(timer);
	}, []);
}
