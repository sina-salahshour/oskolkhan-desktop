/**
 * Session store. Wraps the auth commands and caches the current Session.
 */
import { browser } from '$app/env';
import { api } from '$lib/api';
import type { Session } from '$lib/api';

class SessionStore {
	current = $state<Session | null>(null);
	loading = $state(true);
	#loaded = false;

	get isLoggedIn() {
		return this.current != null;
	}

	get isGuest() {
		return this.current != null && this.current.id === 0;
	}

	get displayName() {
		if (!this.current) return '';
		const full = `${this.current.name} ${this.current.family}`.trim();
		return full || this.current.name;
	}

	get needsOnboarding() {
		return !!this.current && (this.current.needsBirth || this.current.needsContentType);
	}

	async init() {
		if (!browser || this.#loaded) return;
		this.#loaded = true;
		await this.refresh();
	}

	async refresh() {
		this.loading = true;
		try {
			this.current = await api.session();
		} catch {
			this.current = null;
		} finally {
			this.loading = false;
		}
	}

	set(session: Session | null) {
		this.current = session;
	}

	async logout() {
		await api.logout();
		this.current = null;
	}
}

export const session = new SessionStore();
