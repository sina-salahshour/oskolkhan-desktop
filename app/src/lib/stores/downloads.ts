/**
 * Downloads store. Backs the /downloads screen and the per-file Download button.
 *
 * Real transfers run in the Electron main process: `add()` resolves the core
 * local-asset `/stream` URL, hands it to `window.oskol.download(url, filename)`
 * and keeps the returned main-process download id on the item. A single,
 * lazily-installed `onDownloadProgress` subscription funnels progress/terminal
 * events back into the matching item (received/total/percent/speed/state).
 *
 * Note: this fetch-based downloader is start + cancel only — there is no true
 * pause/resume (that needs HTTP Range + partial-file bookkeeping, deferred).
 */
import { create } from 'zustand';
import { useSessionStore } from './session';
import type { DownloadProgress } from '../oskol';

export type DownloadStatus =
	| 'queued'
	| 'downloading'
	| 'paused'
	| 'completed'
	| 'error'
	| 'canceled';

export interface DownloadItem {
	id: string;
	titleId: number;
	title: string;
	/** source file urn (resolved into the core /stream URL) */
	urn: string;
	/** core file id, threaded into the /stream URL (`&id=`) */
	fileId?: number;
	group?: string;
	/** target download directory (a group's folder); empty → app default dir. */
	destDir?: string;
	sizeBytes: number;
	receivedBytes: number;
	speedBps: number;
	status: DownloadStatus;
	addedAt: number;
	/** main-process download id (from window.oskol.download); set once started */
	downloadId?: string;
	/** absolute on-disk path, once the transfer completes */
	path?: string;
	/** internal: last progress sample, for speed estimation */
	_lastTs?: number;
	_lastBytes?: number;
}

export interface DownloadsState {
	items: DownloadItem[];
	selected: Set<string>;
	add: (
		item: Omit<DownloadItem, 'id' | 'addedAt' | 'receivedBytes' | 'speedBps' | 'status'> &
			Partial<DownloadItem>
	) => string;
	remove: (ids: string[]) => void;
	/** Abort an in-flight download (deletes the partial file in main). */
	cancel: (id: string) => void;
	/** Abort every active (queued/downloading) download. */
	cancelAll: () => void;
	toggleSelect: (id: string) => void;
	selectAll: () => void;
	clearSelection: () => void;
}

let seq = 0;

/** Strip path separators + control chars so the renderer never proposes a traversal. */
function safeName(raw: string): string {
	const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	const cleaned = base.replace(/[\x00-\x1f<>:"|?*]/g, '_').replace(/^\.+/, '').trim();
	return cleaned || 'download';
}

/** A human filename for the saved container. Extension is a best-effort guess. */
function fileNameFor(item: Pick<DownloadItem, 'title' | 'group'>): string {
	const stem = [item.title, item.group].filter(Boolean).join(' - ');
	const name = safeName(stem);
	return /\.(mkv|mp4|webm|avi|mov|m4v)$/i.test(name) ? name : `${name}.mkv`;
}

// ---------------------------------------------------------------------------
// Progress plumbing: one subscription for the whole store, installed lazily on
// the first add() (so it never runs in a non-Electron/test context).
// ---------------------------------------------------------------------------
let progressUnsub: (() => void) | null = null;

function applyProgress(p: DownloadProgress): void {
	useDownloadsStore.setState((s) => ({
		items: s.items.map((it) => {
			if (it.downloadId !== p.id) return it;
			switch (p.state) {
				case 'done':
					return {
						...it,
						receivedBytes: p.received || p.total || it.receivedBytes,
						sizeBytes: p.total || p.received || it.sizeBytes,
						speedBps: 0,
						status: 'completed',
						path: p.path,
						_lastTs: undefined,
						_lastBytes: undefined
					};
				case 'error':
					return { ...it, speedBps: 0, status: 'error', _lastTs: undefined, _lastBytes: undefined };
				case 'canceled':
					return { ...it, speedBps: 0, status: 'canceled', _lastTs: undefined, _lastBytes: undefined };
				case 'active':
				default: {
					const now = Date.now();
					const prevTs = it._lastTs ?? it.addedAt;
					const prevBytes = it._lastBytes ?? 0;
					const dt = (now - prevTs) / 1000;
					const speedBps = dt > 0 ? Math.max(0, (p.received - prevBytes) / dt) : it.speedBps;
					return {
						...it,
						receivedBytes: p.received,
						sizeBytes: p.total || it.sizeBytes,
						speedBps,
						status: 'downloading',
						_lastTs: now,
						_lastBytes: p.received
					};
				}
			}
		})
	}));
}

function ensureProgressSubscription(): void {
	if (progressUnsub) return;
	const bridge = typeof window !== 'undefined' ? window.oskol : undefined;
	if (!bridge?.onDownloadProgress) return;
	progressUnsub = bridge.onDownloadProgress(applyProgress);
}

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
			fileId: item.fileId,
			group: item.group,
			destDir: item.destDir,
			sizeBytes: item.sizeBytes ?? 0,
			receivedBytes: 0,
			speedBps: 0,
			status: 'queued',
			addedAt: Date.now()
		};
		set((s) => ({ items: [...s.items, full] }));

		ensureProgressSubscription();

		const bridge = typeof window !== 'undefined' ? window.oskol : undefined;
		const base = useSessionStore.getState().assetBase();
		if (bridge?.download && base && full.urn) {
			const idPart = full.fileId != null ? `&id=${full.fileId}` : '';
			const url = `${base}/stream?urn=${encodeURIComponent(full.urn)}${idPart}`;
			bridge
				.download(url, fileNameFor(full), full.destDir)
				.then((downloadId) => {
					set((s) => ({
						items: s.items.map((x) =>
							x.id === id && x.status === 'queued'
								? { ...x, downloadId, status: 'downloading', _lastTs: Date.now(), _lastBytes: 0 }
								: x.id === id
									? { ...x, downloadId }
									: x
						)
					}));
				})
				.catch(() => {
					set((s) => ({
						items: s.items.map((x) => (x.id === id ? { ...x, status: 'error' } : x))
					}));
				});
		} else {
			// No Electron bridge / no asset base yet — surface it instead of hanging.
			set((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, status: 'error' } : x)) }));
		}

		return id;
	},
	remove: (ids) =>
		set((s) => {
			const bridge = typeof window !== 'undefined' ? window.oskol : undefined;
			const set2 = new Set(ids);
			// Abort any in-flight transfers we're dropping.
			for (const it of s.items) {
				if (set2.has(it.id) && it.downloadId && (it.status === 'downloading' || it.status === 'queued')) {
					void bridge?.cancelDownload?.(it.downloadId);
				}
			}
			const selected = new Set(s.selected);
			ids.forEach((i) => selected.delete(i));
			return { items: s.items.filter((x) => !set2.has(x.id)), selected };
		}),
	cancel: (id) => {
		const it = get().items.find((x) => x.id === id);
		const bridge = typeof window !== 'undefined' ? window.oskol : undefined;
		if (it?.downloadId) void bridge?.cancelDownload?.(it.downloadId);
		set((s) => ({
			items: s.items.map((x) => (x.id === id ? { ...x, speedBps: 0, status: 'canceled' } : x))
		}));
	},
	cancelAll: () => {
		const bridge = typeof window !== 'undefined' ? window.oskol : undefined;
		set((s) => ({
			items: s.items.map((x) => {
				if (x.status !== 'downloading' && x.status !== 'queued') return x;
				if (x.downloadId) void bridge?.cancelDownload?.(x.downloadId);
				return { ...x, speedBps: 0, status: 'canceled' };
			})
		}));
	},
	toggleSelect: (id) =>
		set((s) => {
			const selected = new Set(s.selected);
			selected.has(id) ? selected.delete(id) : selected.add(id);
			return { selected };
		}),
	selectAll: () => set((s) => ({ selected: new Set(s.items.map((x) => x.id)) })),
	clearSelection: () => set({ selected: new Set<string>() })
}));
