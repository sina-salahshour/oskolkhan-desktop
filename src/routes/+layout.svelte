<script lang="ts">
	import '@fontsource-variable/vazirmatn/index.css';
	import '@fontsource-variable/estedad/index.css';
	import '@fontsource-variable/inter/index.css';
	import '../app.css';

	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { i18n } from '$lib/i18n';
	import { status } from '$lib/stores/status.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { ads } from '$lib/stores/ads.svelte';
	import { ui } from '$lib/stores/ui.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import SplashOverlay from '$lib/components/SplashOverlay.svelte';
	import Toaster from '$lib/components/Toaster.svelte';

	let { children } = $props();

	// Routes that take over the whole window (no sidebar / top bar).
	let bare = $derived(
		page.url.pathname.startsWith('/player') || page.url.pathname.startsWith('/auth')
	);

	onMount(() => {
		ui.applyTheme();
		i18n.setLang(i18n.lang);
		status.init();
		session.init();
	});

	// Once the core is ready, warm the PreLoad config (lookup tables).
	$effect(() => {
		if (status.ready) preload.init();
	});

	// Warm the gamification profile (coins / VIP / streak) when signed in.
	$effect(() => {
		if (status.ready && session.isLoggedIn) ads.init();
	});

	// Global Cmd/Ctrl+K opens the command palette.
	function onkeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			ui.togglePalette();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if bare}
	<div class="bare">{@render children()}</div>
{:else}
	<div class="shell">
		<Sidebar />
		<div class="main">
			<TopBar />
			<main class="scroll">{@render children()}</main>
		</div>
	</div>
{/if}

<CommandPalette />
<SplashOverlay />
<Toaster />

<style>
	.shell {
		display: flex;
		block-size: 100vh;
		inline-size: 100vw;
		overflow: hidden;
	}
	.main {
		flex: 1;
		min-inline-size: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.scroll {
		flex: 1;
		overflow-y: auto;
		scroll-behavior: smooth;
	}
	.bare {
		block-size: 100vh;
		inline-size: 100vw;
		overflow: hidden;
	}
</style>
