<script lang="ts" module>
	// Lucide-style 24x24 stroke icons. Keep stroke-based for crisp theming.
	export type IconName =
		| 'home'
		| 'compass'
		| 'search'
		| 'heart'
		| 'heart-filled'
		| 'clock'
		| 'download'
		| 'settings'
		| 'user'
		| 'play'
		| 'play-filled'
		| 'pause'
		| 'plus'
		| 'check'
		| 'x'
		| 'chevron-left'
		| 'chevron-right'
		| 'chevron-down'
		| 'chevron-up'
		| 'star'
		| 'star-filled'
		| 'share'
		| 'external'
		| 'filter'
		| 'grid'
		| 'list'
		| 'sliders'
		| 'volume'
		| 'volume-mute'
		| 'fullscreen'
		| 'pip'
		| 'subtitles'
		| 'gauge'
		| 'skip-next'
		| 'skip-prev'
		| 'trash'
		| 'folder'
		| 'calendar'
		| 'sun'
		| 'moon'
		| 'globe'
		| 'command'
		| 'more'
		| 'mail'
		| 'lock'
		| 'crown'
		| 'coin'
		| 'telegram'
		| 'google'
		| 'rewind'
		| 'forward'
		| 'arrow-right'
		| 'arrow-left'
		| 'menu'
		| 'info'
		| 'film'
		| 'tv';

	const P: Record<IconName, string> = {
		home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
		compass: 'M12 12 9 15l1.5-4.5L15 9l-1.5 4.5zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
		search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
		heart:
			'M12 20s-7-4.4-9.3-8.3C1.1 8.9 2.3 5.5 5.5 5.5c1.9 0 3.2 1 4 2 .8-1 2.1-2 4-2 3.2 0 4.4 3.4 2.8 6.2C19 15.6 12 20 12 20z',
		'heart-filled':
			'M12 20s-7-4.4-9.3-8.3C1.1 8.9 2.3 5.5 5.5 5.5c1.9 0 3.2 1 4 2 .8-1 2.1-2 4-2 3.2 0 4.4 3.4 2.8 6.2C19 15.6 12 20 12 20z',
		clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
		download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
		settings:
			'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
		user: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
		play: 'M6 4.5v15l13-7.5-13-7.5z',
		'play-filled': 'M6 4.5v15l13-7.5-13-7.5z',
		pause: 'M8 5v14M16 5v14',
		plus: 'M12 5v14M5 12h14',
		check: 'M4 12.5 9 17.5 20 6.5',
		x: 'M6 6l12 12M18 6 6 18',
		'chevron-left': 'M15 5l-7 7 7 7',
		'chevron-right': 'M9 5l7 7-7 7',
		'chevron-down': 'M5 9l7 7 7-7',
		'chevron-up': 'M5 15l7-7 7 7',
		star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
		'star-filled': 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
		share:
			'M8.6 13.5l6.8 4M15.4 6.5l-6.8 4M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
		external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
		filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
		grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
		list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
		sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M18 16v4',
		volume: 'M4 9v6h4l5 4V5L8 9H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12',
		'volume-mute': 'M4 9v6h4l5 4V5L8 9H4zM22 9l-6 6M16 9l6 6',
		fullscreen:
			'M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4',
		pip: 'M3 5h18v14H3zM12 12h7v5h-7z',
		subtitles: 'M3 5h18v14H3zM7 14h4M14 14h3M7 10h3M13 10h4',
		gauge: 'M12 13l4-4M20 15a8 8 0 1 0-16 0M12 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
		'skip-next': 'M5 5l9 7-9 7V5zM18 5v14',
		'skip-prev': 'M19 5l-9 7 9 7V5zM6 5v14',
		trash:
			'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
		folder: 'M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
		calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
		sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
		moon: 'M20 14a8 8 0 1 1-9.9-9.9A7 7 0 0 0 20 14z',
		globe:
			'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18',
		command:
			'M8 8h8v8H8zM8 8a2.5 2.5 0 1 0-2.5-2.5V8H8zM8 16a2.5 2.5 0 1 1-2.5 2.5V16H8zM16 8a2.5 2.5 0 1 0 2.5-2.5V8H16zM16 16a2.5 2.5 0 1 1 2.5 2.5V16H16z',
		more: 'M12 6h.01M12 12h.01M12 18h.01',
		mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
		lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
		crown: 'M4 18h16M4 18 3 7l5 4 4-6 4 6 5-4-1 11',
		coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5a2.5 2 0 0 1 2.5-1.5c1.4 0 2.5.7 2.5 1.8s-1 1.7-2.5 1.7-2.5.6-2.5 1.7 1.1 1.8 2.5 1.8a2.5 2 0 0 0 2.5-1.5',
		telegram: 'M21 5 3 12l5 2 2 5 3-4 4 3 4-13zM8 14l9-6-7 7',
		google:
			'M21 12.2c0-.6-.1-1.2-.2-1.8H12v3.5h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3a9 9 0 0 0 2.8-6.8zM12 21c2.4 0 4.5-.8 6-2.2l-3-2.3c-.8.6-1.9.9-3 .9-2.3 0-4.3-1.6-5-3.7H3.9v2.4A9 9 0 0 0 12 21zM7 13.7a5.4 5.4 0 0 1 0-3.4V7.9H3.9a9 9 0 0 0 0 8.2L7 13.7zM12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.9 7.9L7 10.3c.7-2.1 2.7-3.7 5-3.7z',
		rewind: 'M11 5 4 12l7 7V5zM20 5l-7 7 7 7V5z',
		forward: 'M13 5l7 7-7 7V5zM4 5l7 7-7 7V5z',
		'arrow-right': 'M5 12h14M13 6l6 6-6 6',
		'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
		menu: 'M4 6h16M4 12h16M4 18h16',
		info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
		film: 'M3 5h18v14H3zM3 9h18M3 15h18M8 5v14M16 5v14',
		tv: 'M3 6h18v12H3zM8 21h8M12 18v3'
	};

	const FILLED: Partial<Record<IconName, boolean>> = {
		'heart-filled': true,
		'star-filled': true,
		'play-filled': true
	};
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	}
	let { name, size = 20, strokeWidth = 1.8, class: cls = '' }: Props = $props();
	let filled = $derived(FILLED[name] ?? false);
</script>

<svg
	class={cls}
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={P[name]} />
</svg>
