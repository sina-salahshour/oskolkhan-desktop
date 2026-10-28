/**
 * Core status store. Mirrors the core's CoreStatus and keeps itself in sync via
 * the `core://status` event (through api.onStatus).
 */
import { browser } from '$app/env';
import { api } from '$lib/api';
import type { CoreStatus } from '$lib/api';

const INITIAL: CoreStatus = {
	phase: 'starting',
	message: null,
	activeHost: null,
	routes: 0,
	assetBase: '',
	loggedIn: false
};

class StatusStore {
	current = $state<CoreStatus>(INITIAL);
	#subscribed = false;

	get phase() {
		return this.current.phase;
	}

	get ready() {
		return this.current.phase === 'ready';
	}

	get booting() {
		return this.current.phase === 'starting' || this.current.phase === 'bootstrapping';
	}

	get failed() {
		return this.current.phase === 'offline' || this.current.phase === 'error';
	}

	get assetBase() {
		return this.current.assetBase;
	}

	/** Start listening. Safe to call repeatedly; only the first call subscribes. */
	init() {
		if (!browser || this.#subscribed) return;
		this.#subscribed = true;
		// Live push updates (optional): on some webviews the event channel isn't
		// ready at startup; guard it so a failure here never breaks boot.
		try {
			api.onStatus((s) => {
				this.current = s;
			});
		} catch {
			/* events unavailable; polling below keeps status fresh */
		}
		// Poll core_status until the core is ready/errored. This is resilient to
		// early-startup timing and to the push channel being unavailable.
		const poll = async () => {
			try {
				this.current = await api.coreStatus();
			} catch {
				/* core not up yet */
			}
			if (this.current.phase !== 'ready' && this.current.phase !== 'error') {
				setTimeout(poll, 500);
			}
		};
		void poll();
	}

	async retry() {
		try {
			this.current = await api.retryBoot();
		} catch {
			this.current = { ...this.current, phase: 'error', message: 'retry failed' };
		}
	}

	async importKickstart(path: string) {
		this.current = await api.importKickstart(path);
	}
}

export const status = new StatusStore();
