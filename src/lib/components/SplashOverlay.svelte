<script lang="ts">
	import { fade } from 'svelte/transition';
	import { t } from '$lib/i18n';
	import { status } from '$lib/stores/status.svelte';
	import { digits } from '$lib/util/format';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';

	let fileInput = $state<HTMLInputElement | null>(null);
	let importing = $state(false);

	let phaseLabel = $derived.by(() => {
		switch (status.phase) {
			case 'starting':
				return t('boot.starting');
			case 'bootstrapping':
				return t('boot.bootstrapping');
			case 'offline':
				return t('boot.offline');
			case 'error':
				return t('boot.error');
			default:
				return '';
		}
	});

	async function onFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importing = true;
		try {
			// In the browser/mock we only have the file name; the Tauri build will
			// use a real filesystem path (see open item: Tauri dialog plugin).
			await status.importKickstart(file.name);
		} finally {
			importing = false;
		}
	}
</script>

{#if !status.ready}
	<div class="splash" transition:fade={{ duration: 260 }}>
		<div class="grain" aria-hidden="true"></div>
		<div class="inner">
			<div class="mark"><Icon name="film" size={40} /></div>
			<h1>{t('app.name')}</h1>
			<p class="tag">{t('app.tagline')}</p>

			{#if status.booting}
				<div class="live">
					<Spinner size={26} />
					<p class="phase">{phaseLabel}</p>
					{#if status.current.message}<p class="msg">{status.current.message}</p>{/if}
				</div>
			{:else if status.failed}
				<div class="fail">
					<p class="phase danger">{phaseLabel}</p>
					<p class="msg">{status.current.message ?? t('boot.offlineHint')}</p>
					<div class="actions">
						<Button variant="primary" icon="arrow-right" onclick={() => status.retry()}>
							{t('common.retry')}
						</Button>
						<Button
							variant="outline"
							icon="folder"
							loading={importing}
							onclick={() => fileInput?.click()}
						>
							{t('boot.importKickstart')}
						</Button>
					</div>
					<p class="hint">{t('boot.importHint')}</p>
				</div>
			{/if}

			{#if status.current.routes > 0}
				<p class="routes">
					{digits(status.current.routes)}
					{t('boot.routes')}{#if status.current.activeHost}
						· <span class="latin">{status.current.activeHost}</span>{/if}
				</p>
			{/if}
		</div>
		<input bind:this={fileInput} type="file" accept=".osbin,.bin,.okx" hidden onchange={onFile} />
	</div>
{/if}

<style>
	.splash {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		display: grid;
		place-items: center;
		background: radial-gradient(130% 110% at 50% 0%, #15110a 0%, var(--bg-deep) 60%);
		overflow: hidden;
	}
	.grain {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(circle at 20% 30%, var(--accent-glow), transparent 40%),
			radial-gradient(circle at 80% 70%, rgba(88, 166, 255, 0.12), transparent 45%);
		opacity: 0.5;
		animation: drift 14s ease-in-out infinite alternate;
	}
	@keyframes drift {
		to {
			transform: scale(1.15) translateY(-3%);
		}
	}
	.inner {
		position: relative;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-2);
		padding: var(--sp-6);
	}
	.mark {
		inline-size: 84px;
		block-size: 84px;
		display: grid;
		place-items: center;
		border-radius: var(--r-xl);
		background: linear-gradient(135deg, var(--accent-strong), var(--accent-dim));
		color: var(--on-accent);
		box-shadow: 0 10px 40px var(--accent-glow);
		margin-block-end: var(--sp-3);
	}
	h1 {
		font-size: 2rem;
	}
	.tag {
		color: var(--text-muted);
		margin-block-end: var(--sp-5);
	}
	.live {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-3);
	}
	.phase {
		font-weight: 600;
	}
	.phase.danger {
		color: var(--danger);
		font-size: 1.05rem;
	}
	.msg {
		color: var(--text-muted);
		font-size: 0.9rem;
		max-inline-size: 420px;
	}
	.fail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--sp-3);
	}
	.actions {
		display: flex;
		gap: var(--sp-3);
		margin-block-start: var(--sp-2);
	}
	.hint {
		color: var(--text-dim);
		font-size: 0.8rem;
		max-inline-size: 380px;
	}
	.routes {
		margin-block-start: var(--sp-5);
		font-size: 0.82rem;
		color: var(--text-dim);
	}
</style>
