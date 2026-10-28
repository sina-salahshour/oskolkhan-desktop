<script lang="ts">
	import { t } from '$lib/i18n';
	import { digits } from '$lib/util/format';
	import Icon from '../Icon.svelte';
	import Button from '../Button.svelte';

	interface Props {
		/** 7 days oldest→today; `today` is the final slot */
		days: boolean[];
		today: boolean;
		claiming?: boolean;
		onclaim?: () => void;
	}
	let { days, today, claiming = false, onclaim }: Props = $props();

	// streak = trailing consecutive claimed days, counting today.
	let streak = $derived.by(() => {
		const all = [...days.slice(0, -1), today];
		let n = 0;
		for (let i = all.length - 1; i >= 0; i--) {
			if (all[i]) n++;
			else break;
		}
		return n;
	});
	let cells = $derived([...days.slice(0, -1), today]);
	let lastIndex = $derived(cells.length - 1);
</script>

<div class="streak">
	<header>
		<div class="flame" class:hot={streak > 0}>
			<Icon name="flame" size={22} />
			<span class="count latin">{digits(streak)}</span>
		</div>
		<div class="heading">
			<p class="title">{t('gamify.dailyStreak')}</p>
			<p class="sub">{t('gamify.streakDays', { n: digits(streak) })}</p>
		</div>
	</header>

	<div class="days">
		{#each cells as done, i (i)}
			<div class="day" class:done class:today={i === lastIndex}>
				<span class="dot" style="--i:{i}">
					{#if done}<Icon name="check" size={13} />{/if}
				</span>
				<span class="lbl">{i === lastIndex ? t('gamify.today') : digits(i + 1)}</span>
			</div>
		{/each}
	</div>

	{#if today}
		<p class="claimed"><Icon name="check-circle" size={16} />{t('gamify.claimed')}</p>
	{:else}
		<Button variant="primary" icon="gift" block loading={claiming} onclick={() => onclaim?.()}>
			{t('gamify.claim')}
		</Button>
	{/if}
</div>

<style>
	.streak {
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		padding: var(--sp-5);
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}
	.flame {
		position: relative;
		display: grid;
		place-items: center;
		inline-size: 46px;
		block-size: 46px;
		border-radius: var(--r-md);
		background: var(--surface-3);
		color: var(--text-dim);
	}
	.flame.hot {
		background: color-mix(in srgb, var(--streak) 18%, transparent);
		color: var(--streak);
		box-shadow: 0 0 16px var(--streak-glow);
	}
	.count {
		position: absolute;
		inset-block-end: -4px;
		inset-inline-end: -4px;
		min-inline-size: 18px;
		block-size: 18px;
		display: grid;
		place-items: center;
		padding-inline: 4px;
		border-radius: var(--r-full);
		background: var(--streak);
		color: #1a1203;
		font-size: 0.68rem;
		font-weight: 800;
	}
	.title {
		font-weight: 800;
	}
	.sub {
		font-size: 0.82rem;
		color: var(--text-muted);
	}
	.days {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: var(--sp-2);
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.dot {
		display: grid;
		place-items: center;
		inline-size: 100%;
		aspect-ratio: 1;
		max-inline-size: 38px;
		border-radius: var(--r-sm);
		background: var(--surface-3);
		border: 1px solid var(--border);
		color: transparent;
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease),
			transform var(--dur) var(--ease-spring);
	}
	.day.done .dot {
		background: var(--accent-soft);
		border-color: var(--border-accent);
		color: var(--accent-strong);
		animation: pop var(--dur) var(--ease-spring) both;
		animation-delay: calc(var(--i, 0) * 40ms);
	}
	.day.today .dot {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}
	@keyframes pop {
		from {
			transform: scale(0.5);
			opacity: 0;
		}
	}
	.lbl {
		font-size: 0.66rem;
		color: var(--text-dim);
	}
	.day.today .lbl {
		color: var(--accent);
		font-weight: 700;
	}
	.claimed {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		color: var(--success);
		font-weight: 600;
		font-size: 0.9rem;
	}
</style>
