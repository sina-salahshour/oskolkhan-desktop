/**
 * Toast + achievement store. Drives transient notifications and the celebratory
 * reward / level-up moments (confetti burst) shown by <Toaster />.
 */
import { browser } from '$app/env';
import type { IconName } from '$lib/components/Icon.svelte';

export type ToastKind = 'info' | 'success' | 'reward' | 'levelup';

export interface Toast {
	id: number;
	kind: ToastKind;
	title: string;
	message?: string;
	icon?: IconName;
	/** coins earned, shown as an animated +N on reward toasts */
	coins?: number;
	/** fire a restrained confetti burst */
	celebrate?: boolean;
	duration: number;
}

let nextId = 1;

class ToastStore {
	items = $state<Toast[]>([]);
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	#push(t: Omit<Toast, 'id'>): number {
		const id = nextId++;
		this.items = [...this.items, { ...t, id }];
		if (browser && t.duration > 0) {
			this.#timers.set(
				id,
				setTimeout(() => this.dismiss(id), t.duration)
			);
		}
		return id;
	}

	info(title: string, message?: string, icon: IconName = 'info') {
		return this.#push({ kind: 'info', title, message, icon, duration: 3200 });
	}

	success(title: string, message?: string, icon: IconName = 'check-circle') {
		return this.#push({ kind: 'success', title, message, icon, duration: 3200 });
	}

	/** "+N coins" reward moment. */
	reward(title: string, coins: number, message?: string) {
		return this.#push({
			kind: 'reward',
			title,
			coins,
			message,
			icon: 'coin',
			celebrate: true,
			duration: 4200
		});
	}

	/** VIP / level-up celebration. */
	levelUp(title: string, message?: string, icon: IconName = 'crown') {
		return this.#push({
			kind: 'levelup',
			title,
			message,
			icon,
			celebrate: true,
			duration: 5000
		});
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
		const timer = this.#timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.#timers.delete(id);
		}
	}
}

export const toast = new ToastStore();
