<script lang="ts">
	import type { tti } from '$lib/api';
	import { person, placeholderGradient } from '$lib/util/images';

	interface Props {
		item: tti;
	}
	let { item }: Props = $props();

	let failed = $state(false);
	let url = $derived(person(item.img));
	let initials = $derived(
		item.title1
			.split(' ')
			.slice(0, 2)
			.map((w) => w[0] ?? '')
			.join('')
	);
</script>

<div class="person">
	<div class="avatar" style="background:{placeholderGradient(item.id)}">
		{#if url && !failed}
			<img src={url} alt={item.title1} loading="lazy" onerror={() => (failed = true)} />
		{:else}
			<span class="ini">{initials}</span>
		{/if}
	</div>
	<p class="name" title={item.title1}>{item.title1}</p>
	{#if item.title2}<p class="role" title={item.title2}>{item.title2}</p>{/if}
</div>

<style>
	.person {
		inline-size: 100%;
		text-align: center;
	}
	.avatar {
		position: relative;
		inline-size: 100%;
		aspect-ratio: 1;
		border-radius: var(--r-full);
		overflow: hidden;
		margin-inline: auto;
		box-shadow: var(--shadow-sm);
		transition:
			transform var(--dur) var(--ease-out),
			box-shadow var(--dur) var(--ease-out);
	}
	.person:hover .avatar {
		transform: scale(1.06);
		box-shadow:
			var(--shadow-md),
			0 0 0 2px var(--border-accent);
	}
	img {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}
	.ini {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.3rem;
		color: color-mix(in srgb, var(--text) 85%, transparent);
	}
	.name {
		margin-block-start: var(--sp-2);
		font-size: 0.82rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color var(--dur-fast) var(--ease);
	}
	.person:hover .name {
		color: var(--accent);
	}
	.role {
		font-size: 0.72rem;
		color: var(--text-dim);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
