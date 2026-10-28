/**
 * PreLoad store. The backend's PreLoad message is the app's "remote config":
 * it carries the genre / country / language / rating lookup tables that the UI
 * uses to turn numeric ids on titles into labels.
 */
import { browser } from '$app/env';
import { api } from '$lib/api';
import type { PreLoad } from '$lib/api';

class PreloadStore {
	data = $state<PreLoad | null>(null);
	loading = $state(false);
	#loaded = false;

	async init() {
		if (!browser || this.#loaded) return;
		this.#loaded = true;
		this.loading = true;
		try {
			this.data = await api.preload();
		} catch {
			this.data = null;
			this.#loaded = false; // allow retry
		} finally {
			this.loading = false;
		}
	}

	#label(list: string[] | undefined, id: number): string {
		if (!list) return '';
		return list[id] ?? '';
	}

	genre(id: number) {
		return this.#label(this.data?.genre, id);
	}

	genres(ids: number[]) {
		return ids.map((id) => this.genre(id)).filter(Boolean);
	}

	country(id: number) {
		return this.#label(this.data?.countries, id);
	}

	countries(ids: number[]) {
		return ids.map((id) => this.country(id)).filter(Boolean);
	}

	language(id: number) {
		return this.#label(this.data?.languages, id);
	}

	contentRating(id: number) {
		return this.#label(this.data?.contentratingtext, id);
	}

	listingColor(id: number) {
		return this.data?.listingcolors?.[id] ?? 'var(--accent)';
	}

	get genreOptions() {
		return (this.data?.genre ?? []).map((name, id) => ({ id, name }));
	}

	get countryOptions() {
		return (this.data?.countries ?? []).map((name, id) => ({ id, name }));
	}

	get enableGuest() {
		return this.data?.EnableGuestLogin ?? false;
	}

	get botUrl() {
		return this.data?.BotUrl ?? '';
	}
}

export const preload = new PreloadStore();
