<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';

	interface Props {
		value?: string;
		type?: 'text' | 'email' | 'password' | 'search';
		label?: string;
		placeholder?: string;
		icon?: IconName;
		autofocus?: boolean;
		error?: string;
		onenter?: () => void;
		oninput?: (v: string) => void;
	}
	let {
		value = $bindable(''),
		type = 'text',
		label,
		placeholder,
		icon,
		autofocus = false,
		error,
		onenter,
		oninput
	}: Props = $props();

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') onenter?.();
	}
	function handleInput(e: Event) {
		value = (e.target as HTMLInputElement).value;
		oninput?.(value);
	}
</script>

<label class="field" class:error={!!error}>
	{#if label}<span class="lbl">{label}</span>{/if}
	<span class="box">
		{#if icon}<Icon name={icon} size={18} class="ic" />{/if}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			{type}
			{value}
			{placeholder}
			{autofocus}
			{onkeydown}
			oninput={handleInput}
			spellcheck="false"
		/>
	</span>
	{#if error}<span class="msg">{error}</span>{/if}
</label>

<style>
	.field {
		display: block;
	}
	.lbl {
		display: block;
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-block-end: var(--sp-2);
	}
	.box {
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding-inline: var(--sp-3);
		block-size: 44px;
		transition: border-color var(--dur-fast) var(--ease);
	}
	.box :global(.ic) {
		color: var(--text-dim);
		flex: none;
	}
	.box:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--accent-soft);
	}
	input {
		flex: 1;
		min-inline-size: 0;
		background: none;
		border: none;
		outline: none;
		color: var(--text);
	}
	input::placeholder {
		color: var(--text-dim);
	}
	.error .box {
		border-color: var(--danger);
	}
	.msg {
		display: block;
		margin-block-start: var(--sp-2);
		font-size: 0.78rem;
		color: var(--danger);
	}
</style>
