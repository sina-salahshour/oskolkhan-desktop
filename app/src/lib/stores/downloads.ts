/**
 * Downloads store (mock/minimal for Phase 1). Models a download queue + offline
 * library so the /downloads screen has shape to render. Real engine lands later.
 */
import { create } from 'zustand';

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadItem {
	id: string;
	titleId: number;
	title: string;
	/** source file urn (for resolving via playUrl later) */
	urn: string;
	group?: string;
	sizeBytes: number;
	receivedBytes: number;
	speedBps: number;
	status: DownloadStatus;
	addedAt: number;
}

export interface DownloadsState {
	items: DownloadItem[];
	selected: Set<string>;
	add: (item: Omit<DownloadItem, 'id' | 'addedAt' | 'receivedBytes' | 'speedBps' | 'status'> & Partial<DownloadItem>) => string;
	remove: (ids: string[]) => void;
	setStatus: (id: string, status: DownloadStatus) => void;
	pauseAll: () => void;
	resumeAll: () => void;
	toggleSelect: (id: string) => void;
	selectAll: () => void;
	clearSelection: () => void;
}

let seq = 0;

export const useDownloadsStore = create<DownloadsState>((set, get) => ({
	items: [],
	selected: new Set<string>(),
	add: (item) => {
		const id = item.id ?? `d${Date.now().toString(36)}_${(seq++).toString(36)}`;
		const full: DownloadItem = {
			id,
			titleId: item.titleId,
			title: item.title,
			urn: item.urn,
			group: item.group,
			sizeBytes: item.sizeBytes ?? 0,
			receivedBytes: item.receivedBytes ?? 0,
			speedBps: item.speedBps ?? 0,
			status: item.status ?? 'queued',
			addedAt: Date.now()
		};
		set((s) => ({ items: [...s.items, full] }));
		return id;
	},
	remove: (ids) =>
		set((s) => {
			const set2 = new Set(ids);
			const selected = new Set(s.selected);
			ids.forEach((i) => selected.delete(i));
			return { items: s.items.filter((x) => !set2.has(x.id)), selected };
		}),
	setStatus: (id, status) =>
		set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, status } : x)) })),
	pauseAll: () =>
		set((s) => ({
			items: s.items.map((x) => (x.status === 'downloading' ? { ...x, status: 'paused' } : x))
		})),
	resumeAll: () =>
		set((s) => ({
			items: s.items.map((x) => (x.status === 'paused' ? { ...x, status: 'downloading' } : x))
		})),
	toggleSelect: (id) =>
		set((s) => {
			const selected = new Set(s.selected);
			selected.has(id) ? selected.delete(id) : selected.add(id);
			return { selected };
		}),
	selectAll: () => set((s) => ({ selected: new Set(s.items.map((x) => x.id)) })),
	clearSelection: () => set({ selected: new Set<string>() })
}));
