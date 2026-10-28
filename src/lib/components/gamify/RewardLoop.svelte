<script lang="ts">
	import { t } from '$lib/i18n';
	import { digits } from '$lib/util/format';
	import Icon from '../Icon.svelte';
	import Button from '../Button.svelte';

	interface Props {
		available: boolean;
		needVpn?: boolean;
		amount?: number;
		adsToday?: number;
		onclaim?: (amount: number) => void;
	}
	let { available, needVpn = false, amount = 50, adsToday = 0, onclaim }: Props = $props();

	let busy = $state(false);

	const reduce =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	function watch() {
		if (busy || !available) return;
		busy = true;
		// Ads are out of scope — we only show the reward UX. Simulate the short
		// watch, then hand the earned coins back to the parent.
		setTimeout(
			() => {
				busy = false;
				onclaim?.(amount);
			},
			reduce ? 0 : 1400
		);
	}
</script>

<div class="reward" class:busy>
	<div class="glow" aria-hidden="true"></div>
	<div class="icon"><Icon name="clapperboard" size={26} /></div>
	<div class="text">
		<p class="title">{t('gamify.watchAd')}</p>
		<p class="desc">{t('gamify.watchAdDesc')}</p>
		{#if adsToday > 0}
			<p class="meta">
				<Icon name="eye" size={13} />{t('gamify.adsToday', { n: digits(adsToday) })}
			</p>
		{/if}
	</div>
	<div class="action">
		{#if needVpn}
			<p class="hint"><Icon name="info" size={14} />{t('gamify.needVpn')}</p>
		{:else if !available}
			<p class="hint"><Icon name="info" size={14} />{t('gamify.unavailable')}</p>
		{/if}
		<Button variant="primary" icon="coin" loading={busy} disabled={!available} onclick={watch}>
			{busy ? t('gamify.earning') : t('gamify.earnCoins', { n: digits(amount) })}
		</Button>
	</div>
</div>

<style>
	.reward {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		padding: var(--sp-5);
		border: 1px solid var(--border-accent);
		border-radius: var(--r-lg);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent) 10%, var(--surface-1)),
			var(--surface-1)
		);
	}
	.glow {
		position: absolute;
		inset-block-start: -50%;
		inset-inline-start: -10%;
		inline-size: 240px;
		block-size: 240px;
		border-radius: 50%;
		background: var(--accent-glow);
		filter: blur(70px);
		opacity: 0.6;
		pointer-events: none;
		transition: opacity var(--dur) var(--ease);
	}
	.busy .glow {
		opacity: 1;
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.15);
		}
	}
	.icon {
		position: relative;
		display: grid;
		place-items: center;
		inline-size: 52px;
		block-size: 52px;
		flex: none;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 6px 20px var(--accent-glow);
	}
	.text {
		flex: 1;
		min-inline-size: 0;
	}
	.title {
		font-weight: 800;
		font-size: 1rem;
	}
	.desc {
		font-size: 0.84rem;
		color: var(--text-muted);
		margin-block-start: 2px;
	}
	.meta {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-block-start: var(--sp-2);
		font-size: 0.76rem;
		color: var(--text-dim);
	}
	.action {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--sp-2);
		flex: none;
	}
	.hint {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.74rem;
		color: var(--warning);
	}
	@media (max-width: 640px) {
		.reward {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}
		.action {
			align-items: stretch;
		}
	}
</style>
