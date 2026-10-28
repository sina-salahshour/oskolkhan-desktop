<script lang="ts">
	import { fly, scale } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { Confetti } from 'svelte-confetti';
	import { toast } from '$lib/stores/toast.svelte';
	import { i18n } from '$lib/i18n';
	import { digits } from '$lib/util/format';
	import Icon from './Icon.svelte';

	const reduce =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	let celebrating = $derived(toast.items.some((t) => t.celebrate) && !reduce);
	let flyX = $derived(i18n.isRtl ? -24 : 24);
</script>

{#if celebrating}
	<div class="confetti" aria-hidden="true">
		<Confetti
			amount={70}
			duration={2600}
			cone
			x={[-0.5, 0.5]}
			y={[0.25, 1]}
			colorArray={['var(--accent)', 'var(--accent-strong)', '#fff', 'var(--coin)', 'var(--xp)']}
		/>
	</div>
{/if}

<div class="toaster" aria-live="polite">
	{#each toast.items as t (t.id)}
		<div
			class="toast {t.kind}"
			role="status"
			animate:flip={{ duration: 220 }}
			in:fly={{ x: flyX, y: 8, duration: 240 }}
			out:scale={{ start: 0.9, duration: 180 }}
		>
			{#if t.icon}
				<span class="ic"><Icon name={t.icon} size={20} /></span>
			{/if}
			<div class="body">
				<p class="title">{t.title}</p>
				{#if t.message}<p class="msg">{t.message}</p>{/if}
			</div>
			{#if t.coins}
				<span class="coins latin">+{digits(t.coins)}</span>
			{/if}
			<button class="x" aria-label="dismiss" onclick={() => toast.dismiss(t.id)}>
				<Icon name="x" size={15} />
			</button>
		</div>
	{/each}
</div>

<style>
	.confetti {
		position: fixed;
		inset-block-start: 0;
		inset-inline: 0;
		display: flex;
		justify-content: center;
		z-index: var(--z-toast);
		pointer-events: none;
	}
	.toaster {
		position: fixed;
		inset-block-end: var(--sp-5);
		inset-inline-end: var(--sp-5);
		z-index: var(--z-toast);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		max-inline-size: min(360px, calc(100vw - var(--sp-5) * 2));
	}
	.toast {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		padding: var(--sp-3) var(--sp-4);
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-lg);
	}
	.toast.success {
		border-color: color-mix(in srgb, var(--success) 45%, transparent);
	}
	.toast.reward,
	.toast.levelup {
		border-color: var(--border-accent);
		background: linear-gradient(
			135deg,
			var(--elevated),
			color-mix(in srgb, var(--accent) 8%, var(--elevated))
		);
	}
	.ic {
		display: grid;
		place-items: center;
		inline-size: 36px;
		block-size: 36px;
		flex: none;
		border-radius: var(--r-sm);
		background: var(--surface-2);
		color: var(--accent);
	}
	.success .ic {
		color: var(--success);
	}
	.reward .ic,
	.levelup .ic {
		background: var(--accent-soft);
		color: var(--accent-strong);
	}
	.body {
		flex: 1;
		min-inline-size: 0;
	}
	.title {
		font-weight: 700;
		font-size: 0.9rem;
	}
	.msg {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-block-start: 2px;
	}
	.coins {
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--coin);
		text-shadow: 0 0 12px var(--coin-glow);
		flex: none;
	}
	.x {
		display: grid;
		place-items: center;
		inline-size: 26px;
		block-size: 26px;
		flex: none;
		border: none;
		background: transparent;
		color: var(--text-dim);
		border-radius: var(--r-full);
		transition: all var(--dur-fast) var(--ease);
	}
	.x:hover {
		background: var(--surface-2);
		color: var(--text);
	}
</style>
