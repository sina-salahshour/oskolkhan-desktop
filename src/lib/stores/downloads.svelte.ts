/**
 * Downloads store. Phase 1 is a fully mocked queue + offline library so the
 * Downloads UI is browsable. Real chunked downloads are phase 2 (native core).
 */
import { browser } from '$app/env';
import { SvelteSet } from 'svelte/reactivity';
import { TITLES } from '$lib/api/fixtures';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed';

export interface DownloadGroup {
	id: number;
	name: string;
	folder: string;
	chunks: number; // 1..8
	autoStart: boolean;
	schedule: string; // '' = none, else HH:mm
}

export interface DownloadItem {
	id: number;
	groupId: number;
	titleId: number;
	title: string;
	subtitle: string; // e.g. "S2 E7 · 1080p"
	quality: string;
	status: DownloadStatus;
	progress: number; // 0..100
	sizeMb: number;
	speedKbps: number;
}

let nextId = 1000;

class DownloadsStore {
	groups = $state<DownloadGroup[]>([
		{
			id: 1,
			name: 'پیش‌فرض',
			folder: '~/Downloads/OskolKhan',
			chunks: 4,
			autoStart: true,
			schedule: ''
		},
		{
			id: 2,
			name: 'شب‌ها',
			folder: '~/Media/Series',
			chunks: 8,
			autoStart: false,
			schedule: '02:00'
		}
	]);

	queue = $state<DownloadItem[]>([
		{
			id: 1,
			groupId: 1,
			titleId: 104,
			title: 'شوگون',
			subtitle: 'فصل ۱ قسمت ۸ · 4K HDR',
			quality: '2160p',
			status: 'downloading',
			progress: 62,
			sizeMb: 4800,
			speedKbps: 7400
		},
		{
			id: 2,
			groupId: 1,
			titleId: 102,
			title: 'تل‌ماسه: بخش دوم',
			subtitle: '1080p · x265',
			quality: '1080p',
			status: 'downloading',
			progress: 23,
			sizeMb: 1800,
			speedKbps: 5100
		},
		{
			id: 3,
			groupId: 2,
			titleId: 106,
			title: 'پسران',
			subtitle: 'فصل ۴ قسمت ۳ · دوبله',
			quality: '1080p',
			status: 'queued',
			progress: 0,
			sizeMb: 1600,
			speedKbps: 0
		},
		{
			id: 4,
			groupId: 1,
			titleId: 103,
			title: 'بازی مرکب',
			subtitle: 'فصل ۲ قسمت ۱ · 1080p',
			quality: '1080p',
			status: 'paused',
			progress: 45,
			sizeMb: 1700,
			speedKbps: 0
		}
	]);

	library = $state<DownloadItem[]>([
		{
			id: 900,
			groupId: 1,
			titleId: 101,
			title: 'تلألو',
			subtitle: '4K HDR · کامل',
			quality: '2160p',
			status: 'completed',
			progress: 100,
			sizeMb: 5200,
			speedKbps: 0
		},
		{
			id: 901,
			groupId: 1,
			titleId: 107,
			title: 'گودزیلا منهای یک',
			subtitle: '1080p · x265',
			quality: '1080p',
			status: 'completed',
			progress: 100,
			sizeMb: 1900,
			speedKbps: 0
		}
	]);

	selected = new SvelteSet<number>();
	#timer: ReturnType<typeof setInterval> | null = null;

	get activeCount() {
		return this.queue.filter((d) => d.status === 'downloading').length;
	}

	init() {
		if (!browser || this.#timer) return;
		this.#timer = setInterval(() => this.#tick(), 1000);
	}

	dispose() {
		if (this.#timer) {
			clearInterval(this.#timer);
			this.#timer = null;
		}
	}

	#tick() {
		let changed = false;
		const next = this.queue.map((d) => {
			if (d.status !== 'downloading') return d;
			changed = true;
			const step = 0.6 + Math.random() * 1.6;
			const progress = Math.min(100, d.progress + step);
			if (progress >= 100) {
				this.library = [
					{ ...d, status: 'completed', progress: 100, speedKbps: 0 },
					...this.library
				];
				return null;
			}
			const speedKbps = Math.round(4000 + Math.random() * 6000);
			return { ...d, progress, speedKbps };
		});
		if (changed) {
			this.queue = next.filter((d): d is DownloadItem => d !== null);
			// auto-start next queued item if a slot opened
			if (this.activeCount === 0) {
				const q = this.queue.find((d) => d.status === 'queued');
				if (q) q.status = 'downloading';
			}
		}
	}

	toggleSelect(id: number) {
		if (this.selected.has(id)) this.selected.delete(id);
		else this.selected.add(id);
	}

	selectAll(ids: number[]) {
		this.selected.clear();
		for (const id of ids) this.selected.add(id);
	}

	clearSelection() {
		this.selected.clear();
	}

	pause(id: number) {
		const d = this.queue.find((x) => x.id === id);
		if (d) {
			d.status = 'paused';
			d.speedKbps = 0;
		}
	}

	resume(id: number) {
		const d = this.queue.find((x) => x.id === id);
		if (d) d.status = 'downloading';
	}

	toggle(id: number) {
		const d = this.queue.find((x) => x.id === id);
		if (!d) return;
		if (d.status === 'downloading') this.pause(id);
		else if (d.status === 'paused' || d.status === 'queued') this.resume(id);
	}

	pauseAll() {
		for (const d of this.queue) if (d.status === 'downloading') d.status = 'paused';
	}

	resumeAll() {
		for (const d of this.queue)
			if (d.status === 'paused' || d.status === 'queued') d.status = 'downloading';
	}

	removeSelected() {
		this.queue = this.queue.filter((d) => !this.selected.has(d.id));
		this.library = this.library.filter((d) => !this.selected.has(d.id));
		this.clearSelection();
	}

	remove(id: number) {
		this.queue = this.queue.filter((d) => d.id !== id);
		this.library = this.library.filter((d) => d.id !== id);
	}

	addFromTitle(titleId: number, quality: string, subtitle: string, groupId = 1) {
		const t = TITLES.find((x) => x.id === titleId);
		this.queue = [
			...this.queue,
			{
				id: ++nextId,
				groupId,
				titleId,
				title: t?.persian ?? 'عنوان',
				subtitle,
				quality,
				status: this.groups.find((g) => g.id === groupId)?.autoStart ? 'downloading' : 'queued',
				progress: 0,
				sizeMb: 1500 + Math.floor(Math.random() * 3000),
				speedKbps: 0
			}
		];
	}

	addGroup(group: Omit<DownloadGroup, 'id'>) {
		const id = Math.max(0, ...this.groups.map((g) => g.id)) + 1;
		this.groups = [...this.groups, { ...group, id }];
	}
}

export const downloads = new DownloadsStore();
