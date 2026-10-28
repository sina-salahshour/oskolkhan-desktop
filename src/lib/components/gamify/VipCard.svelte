<script lang="ts">
	import { t } from '$lib/i18n';
	import { digits } from '$lib/util/format';
	import Icon from '../Icon.svelte';
	import Badge from '../Badge.svelte';
	import ProgressRing from '../ProgressRing.svelte';
	import AnimatedNumber from '../AnimatedNumber.svelte';

	interface Props {
		vip: boolean;
		level: number;
		coins: number;
		/** coins required per level step */
		step?: number;
	}
	let { vip, level, coins, step = 1000 }: Props = $props();

	let intoLevel = $derived(coins % step);
	let toNext = $derived(step - intoLevel);
	let ratio = $derived(intoLevel / step);

	const perks: { icon: 'subtitles' | 'shield' | 'zap'; key: string }[] = [
		{ icon: 'subtitles', key: 'gamify.perk4k' },
		{ icon: 'shield', key: 'gamify.perkNoAds' },
		{ icon: 'zap', key: 'gamify.perkEarly' }
	];
</script>

<div class="vip" class:active={vip}>
	<div class="sheen" aria-hidden="true"></div>
	<div class="top">
		<div class="label">
			<span class="crown"><Icon name="crown" size={22} /></span>
			<div>
				<p class="k">{t('gamify.vipCard')}</p>
				{#if vip}
					<p class="lvl">{t('gamify.vipLevel', { n: digits(level) })}</p>
				{:else}
					<p class="lvl dim">{t('gamify.notVipYet')}</p>
				{/if}
			</div>
		</div>
		{#if vip}<Badge tone="gold">VIP</Badge>{/if}
	</div>

	<div class="body">
		<ProgressRing value={ratio} size={104} stroke={9} tone="var(--accent)">
			<span class="ring-lvl latin">{digits(level)}</span>
			<span class="ring-sub">{t('gamify.toNextLevel')}</span>
		</ProgressRing>
		<div class="info">
			<p class="coins-line">
				<Icon name="coin" size={18} />
				<AnimatedNumber value={coins} />
				<span class="muted">{t('gamify.coins')}</span>
			</p>
			<p class="next">{t('gamify.coinsToNext', { n: digits(toNext) })}</p>
			<ul class="perks">
				{#each perks as p (p.key)}
					<li><Icon name={p.icon} size={15} />{t(p.key)}</li>
				{/each}
			</ul>
		</div>
	</div>
</div>

<style>
	.vip {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: var(--sp-5);
		background: linear-gradient(135deg, var(--surface-2), var(--surface-1));
	}
	.vip.active {
		border-color: var(--border-accent);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--accent) 14%, var(--surface-2)),
			var(--surface-1)
		);
		box-shadow: var(--shadow-md);
	}
	.sheen {
		position: absolute;
		inset-block-start: -60%;
		inset-inline-end: -20%;
		inline-size: 60%;
		block-size: 200%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
		transform: rotate(18deg);
		pointer-events: none;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-block-end: var(--sp-4);
	}
	.label {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.crown {
		display: grid;
		place-items: center;
		inline-size: 42px;
		block-size: 42px;
		border-radius: var(--r-md);
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	.k {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.lvl {
		font-weight: 800;
		font-size: 1.05rem;
	}
	.lvl.dim {
		color: var(--text-muted);
		font-weight: 600;
	}
	.body {
		display: flex;
		align-items: center;
		gap: var(--sp-5);
	}
	.ring-lvl {
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--accent);
	}
	.ring-sub {
		display: block;
		font-size: 0.6rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-dim);
	}
	.info {
		flex: 1;
		min-inline-size: 0;
	}
	.coins-line {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-weight: 800;
		font-size: 1.15rem;
		color: var(--coin);
	}
	.coins-line .muted {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
	}
	.next {
		font-size: 0.82rem;
		color: var(--text-muted);
		margin-block: 4px var(--sp-3);
	}
	.perks {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.perks li {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.perks :global(svg) {
		color: var(--accent);
	}
</style>
