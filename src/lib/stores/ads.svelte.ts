/**
 * Gamification store. Wraps the backend `adProfile` message (coins, VIP level,
 * daily-reward streak) and owns the optimistic reward loop — claiming the daily
 * reward and the "watch ad for coins" flow (ads are out of scope; we model only
 * the reward UX). Shared by the TopBar coin chip and the Account screen.
 */
import { browser } from '$app/env';
import { api } from '$lib/api';
import type { adProfile } from '$lib/api';
import { toast } from './toast.svelte';
import { i18n } from '$lib/i18n';
import { digits } from '$lib/util/format';

/** coins required per VIP level step */
export const VIP_STEP = 1000;

class AdsStore {
	data = $state<adProfile | null>(null);
	loading = $state(false);
	#loaded = false;

	get coins() {
		return this.data?.Coins ?? 0;
	}
	get vip() {
		return this.data?.Vip ?? false;
	}
	get vipLevel() {
		return this.data?.VipLevel ?? 0;
	}
	/** last 7 days oldest→newest (DayMinus6 … DayMinus1) then Today is separate */
	get weekDays(): boolean[] {
		const d = this.data;
		if (!d) return Array(7).fill(false);
		return [d.DayMinus6, d.DayMinus5, d.DayMinus4, d.DayMinus3, d.DayMinus2, d.DayMinus1, d.Today];
	}
	get claimedToday() {
		return this.data?.Today ?? false;
	}
	get adsToday() {
		return this.data?.TodayAds ?? 0;
	}
	get nextAdAvailable() {
		return this.data?.NextADSavailable ?? false;
	}
	get nextAdNeedsVpn() {
		return this.data?.NextADSneedVPN ?? false;
	}

	async init() {
		if (!browser || this.#loaded) return;
		this.#loaded = true;
		this.loading = true;
		try {
			this.data = await api.adProfile();
		} catch {
			this.data = null;
			this.#loaded = false; // allow retry
		} finally {
			this.loading = false;
		}
	}

	/** Optimistic coin add. Returns whether a VIP level-up happened. */
	#addCoins(n: number): boolean {
		if (!this.data) return false;
		const before = Math.floor(this.data.Coins / VIP_STEP);
		this.data.Coins += n;
		const after = Math.floor(this.data.Coins / VIP_STEP);
		if (after > before) {
			this.data.VipLevel = after;
			this.data.Vip = true;
			return true;
		}
		return false;
	}

	/** Claim the daily reward (optimistic + celebratory). */
	claimDaily(amount = 100) {
		if (!this.data || this.data.Today) return;
		this.data.Today = true;
		const leveled = this.#addCoins(amount);
		toast.reward(i18n.t('gamify.rewardEarned'), amount, i18n.t('gamify.dailyReward'));
		if (leveled) {
			toast.levelUp(
				i18n.t('gamify.levelUp', { n: digits(this.data.VipLevel) }),
				undefined,
				'crown'
			);
		}
	}

	/** Collect a "watch ad" reward (ads out of scope — reward UX only). */
	collectAdReward(amount: number) {
		if (!this.data) return;
		const leveled = this.#addCoins(amount);
		this.data.TodayAds += 1;
		toast.reward(
			i18n.t('gamify.rewardEarned'),
			amount,
			i18n.t('gamify.coinsAdded', { n: digits(amount) })
		);
		if (leveled) {
			toast.levelUp(
				i18n.t('gamify.levelUp', { n: digits(this.data.VipLevel) }),
				undefined,
				'crown'
			);
		}
	}
}

export const ads = new AdsStore();
