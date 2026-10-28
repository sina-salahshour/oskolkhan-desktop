<script lang="ts">
	import { Toggle as MeltToggle } from 'melt/builders';

	interface Props {
		checked?: boolean;
		label?: string;
		disabled?: boolean;
		onchange?: (v: boolean) => void;
	}
	let { checked = $bindable(false), label, disabled = false, onchange }: Props = $props();

	// Melt owns the switch behaviour, keyboard, and aria-pressed.
	const toggle = new MeltToggle({
		value: () => checked,
		disabled: () => disabled,
		onValueChange: (v) => {
			checked = v;
			onchange?.(v);
		}
	});
</script>

<button {...toggle.trigger} class="toggle" role="switch" aria-checked={checked} aria-label={label}>
	<span class="track" class:on={checked}><span class="knob"></span></span>
	{#if label}<span class="lbl">{label}</span>{/if}
</button>

<style>
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-3);
		background: none;
		border: none;
		padding: 0;
	}
	.toggle:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.track {
		inline-size: 42px;
		block-size: 24px;
		border-radius: var(--r-full);
		background: var(--surface-3);
		border: 1px solid var(--border);
		position: relative;
		transition:
			background var(--dur) var(--ease),
			border-color var(--dur) var(--ease);
		flex: none;
	}
	.track.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.knob {
		position: absolute;
		inset-block-start: 2px;
		inset-inline-start: 2px;
		inline-size: 18px;
		block-size: 18px;
		border-radius: 50%;
		background: #fff;
		box-shadow: var(--shadow-sm);
		transition:
			inset-inline-start var(--dur) var(--ease-spring),
			width var(--dur-fast) var(--ease);
	}
	.toggle:active .knob {
		inline-size: 22px;
	}
	.track.on .knob {
		inset-inline-start: 20px;
	}
	.lbl {
		font-size: 0.9rem;
		color: var(--text);
	}
</style>
