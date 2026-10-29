/**
 * Feature-local store for download GROUPS. The foundation `downloads` store
 * models the queue + offline items; groups (destination folder / chunking /
 * auto-start / schedule) are a configuration concept with no engine yet, so we
 * keep them here (persisted) rather than touching the read-only foundation store.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DownloadGroup {
	id: string;
	name: string;
	folder: string;
	/** parallel chunk count, 1-8 */
	chunks: number;
	autoStart: boolean;
	/** optional "HH:mm" schedule */
	schedule: string;
}

export interface GroupsState {
	groups: DownloadGroup[];
	addGroup: (g: Omit<DownloadGroup, 'id'>) => void;
	removeGroup: (id: string) => void;
}

let seq = 0;

export const useGroupsStore = create<GroupsState>()(
	persist(
		(set) => ({
			groups: [],
			addGroup: (g) =>
				set((s) => ({
					groups: [...s.groups, { ...g, id: `g${Date.now().toString(36)}_${(seq++).toString(36)}` }]
				})),
			removeGroup: (id) => set((s) => ({ groups: s.groups.filter((x) => x.id !== id) }))
		}),
		{ name: 'oskol.downloadGroups' }
	)
);
