/**
 * Session store: the current signed-in Session projection and a cached CoreStatus
 * snapshot (for synchronous access to assetBase / loggedIn outside React Query).
 * TanStack Query remains the fetch authority; this store mirrors the latest values
 * so non-component code (image builders, logger scope) can read them cheaply.
 */
import { create } from 'zustand';
import type { Session, CoreStatus } from '../api/contract';

export interface SessionState {
	session: Session | null;
	status: CoreStatus | null;
	setSession: (s: Session | null) => void;
	setStatus: (s: CoreStatus | null) => void;
	assetBase: () => string;
	loggedIn: () => boolean;
}

export const useSessionStore = create<SessionState>((set, get) => ({
	session: null,
	status: null,
	setSession: (session) => set({ session }),
	setStatus: (status) => set({ status }),
	assetBase: () => get().status?.assetBase ?? '',
	loggedIn: () => get().status?.loggedIn ?? get().session != null
}));
