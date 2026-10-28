<script lang="ts">
	interface Props {
		width?: string;
		height?: string;
		radius?: string;
		class?: string;
	}
	let {
		width = '100%',
		height = '1rem',
		radius = 'var(--r-md)',
		class: cls = ''
	}: Props = $props();
</script>

<div
	class="skeleton {cls}"
	style="width:{width};height:{height};border-radius:{radius}"
	aria-hidden="true"
></div>
