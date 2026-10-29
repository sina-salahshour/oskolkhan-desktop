/**
 * Toast store: a tiny queue consumed by <Toaster/>. The logger (lib/logger.ts)
 * pushes error toasts here; UI code can push success/info toasts too.
 */
import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
	id: string;
	tone: ToastTone;
	title: string;
	description?: string;
	/** ms before auto-dismiss; 0 = sticky */
	duration: number;
	action?: { label: string; onClick: () => void };
}

export interface ToastInput {
	tone?: ToastTone;
	title: string;
	description?: string;
	duration?: number;
	action?: { label: string; onClick: () => void };
}

export interface ToastState {
	toasts: Toast[];
	push: (t: ToastInput) => string;
	dismiss: (id: string) => void;
	clear: () => void;
}

let seq = 0;
const nextId = () => `t${Date.now().toString(36)}_${(seq++).toString(36)}`;

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	push: (t) => {
		const id = nextId();
		const toast: Toast = {
			id,
			tone: t.tone ?? 'info',
			title: t.title,
			description: t.description,
			duration: t.duration ?? (t.tone === 'error' ? 6000 : 4000),
			action: t.action
		};
		set((s) => ({ toasts: [...s.toasts, toast] }));
		return id;
	},
	dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
	clear: () => set({ toasts: [] })
}));

/** Imperative helper for non-component code. */
export const toast = (t: ToastInput) => useToastStore.getState().push(t);
