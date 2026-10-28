<script lang="ts">
	import { t } from '$lib/i18n';
	import Icon from './Icon.svelte';
	import Button from './Button.svelte';
	interface Props {
		message?: string;
		onretry?: () => void;
	}
	let { message, onretry }: Props = $props();
</script>

<div class="err" role="alert">
	<div class="orb"><Icon name="info" size={26} /></div>
	<p class="t">{t('error.generic')}</p>
	{#if message}<p class="d">{message}</p>{/if}
	{#if onretry}
		<Button variant="outline" icon="arrow-right" onclick={onretry}>{t('common.retry')}</Button>
	{/if}
</div>

<style>
	.err {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--sp-3);
		padding-block: var(--sp-7);
		color: var(--text-muted);
	}
	.orb {
		inline-size: 60px;
		block-size: 60px;
		display: grid;
		place-items: center;
		border-radius: var(--r-full);
		background: var(--danger-soft);
		color: var(--danger);
	}
	.t {
		font-size: 1rem;
		font-weight: 700;
		color: var(--text);
	}
	.d {
		max-inline-size: 360px;
		font-size: 0.88rem;
	}
</style>
