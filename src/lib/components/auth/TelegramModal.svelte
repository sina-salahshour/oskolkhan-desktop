<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import { session } from '$lib/stores/session.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { t } from '$lib/i18n';
	import Modal from '../Modal.svelte';
	import Button from '../Button.svelte';
	import Icon from '../Icon.svelte';
	import Spinner from '../Spinner.svelte';

	interface Props {
		open?: boolean;
	}
	let { open = $bindable(false) }: Props = $props();

	let botUrl = $state('');
	let error = $state('');
	let done = false;

	async function handle(result: Awaited<ReturnType<typeof api.authTelegramPoll>>) {
		if (!result || done) return;
		done = true;
		session.set(result);
		await goto('/');
	}

	$effect(() => {
		if (!open) return;
		done = false;
		error = '';
		botUrl = preload.botUrl || '';
		let cancelled = false;
		let timer: ReturnType<typeof setInterval> | undefined;

		api
			.authTelegramStart()
			.then((r) => {
				if (cancelled) return;
				botUrl = r.botUrl || botUrl;
				timer = setInterval(async () => {
					try {
						const res = await api.authTelegramPoll();
						if (!cancelled) await handle(res);
					} catch {
						/* keep polling */
					}
				}, 2500);
			})
			.catch((e: { message?: string }) => {
				if (!cancelled) error = e?.message || t('auth.failed');
			});

		return () => {
			cancelled = true;
			if (timer) clearInterval(timer);
		};
	});

	// Decorative pseudo-QR pattern (deterministic)
	const cells = Array.from({ length: 169 }, (_, i) => (i * 7 + ((i * i) % 11)) % 3 !== 0);
</script>

<Modal bind:open title={t('auth.loginTelegram')} width="420px">
	<div class="body">
		<p class="hint">{t('auth.telegramScan')}</p>
		<div class="qr" aria-hidden="true">
			<div class="grid">
				{#each cells as on, i (i)}<span class:on></span>{/each}
			</div>
			<div class="badge"><Icon name="telegram" size={26} /></div>
		</div>
		{#if botUrl}<code class="url" dir="ltr">{botUrl}</code>{/if}
		{#if error}
			<p class="err">{error}</p>
		{:else}
			<Spinner size={20} label={t('auth.telegramWaiting')} />
		{/if}
		{#if botUrl}
			<Button variant="primary" icon="telegram" href={botUrl} block>{t('auth.telegramOpen')}</Button
			>
		{/if}
	</div>
</Modal>

<style>
	.body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-4);
		text-align: center;
	}
	.hint {
		color: var(--text-muted);
		font-size: 0.9rem;
	}
	.qr {
		position: relative;
		padding: var(--sp-3);
		background: var(--text);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow-md);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(13, 1fr);
		width: 176px;
		height: 176px;
		gap: 1px;
	}
	.grid span {
		border-radius: 2px;
	}
	.grid span.on {
		background: var(--bg-deep);
	}
	.badge {
		position: absolute;
		inset: 50% auto auto 50%;
		translate: -50% -50%;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--on-accent);
		border: 4px solid var(--text);
	}
	.url {
		font-size: 0.8rem;
		color: var(--text-dim);
		word-break: break-all;
	}
	.err {
		color: var(--danger);
		font-size: 0.85rem;
	}
</style>
