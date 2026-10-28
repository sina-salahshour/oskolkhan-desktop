<script lang="ts" module>
	/**
	 * Single-source icon component, backed by the Lucide pack (@lucide/svelte).
	 * All UI icons come from one pack with a consistent stroke + size.
	 * The `IconName` union is the stable public API used across the app, so call
	 * sites never import Lucide directly. Brand marks (Google, Telegram) are the
	 * documented exception and render as their own logos.
	 */
	import type { Component } from 'svelte';
	import type { LucideProps } from '@lucide/svelte';
	import {
		House,
		Compass,
		Search,
		Heart,
		Clock,
		Download,
		Settings,
		User,
		Play,
		Pause,
		Plus,
		Check,
		X,
		ChevronLeft,
		ChevronRight,
		ChevronDown,
		ChevronUp,
		Star,
		Share2,
		ExternalLink,
		Filter,
		LayoutGrid,
		List,
		SlidersHorizontal,
		Volume2,
		VolumeX,
		Maximize,
		PictureInPicture,
		Captions,
		Gauge,
		SkipForward,
		SkipBack,
		Trash2,
		Folder,
		Calendar,
		Sun,
		Moon,
		Globe,
		Command,
		MoreHorizontal,
		Mail,
		Lock,
		Crown,
		Coins,
		Rewind,
		FastForward,
		ArrowRight,
		ArrowLeft,
		Menu,
		Info,
		Film,
		Tv,
		Flame,
		Trophy,
		Gift,
		Zap,
		Sparkles,
		Medal,
		Shield,
		Ticket,
		Clapperboard,
		Bell,
		LogOut,
		CircleCheck,
		Eye
	} from '@lucide/svelte';

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
		| 'tv'
		| 'flame'
		| 'trophy'
		| 'gift'
		| 'zap'
		| 'sparkles'
		| 'medal'
		| 'shield'
		| 'ticket'
		| 'clapperboard'
		| 'bell'
		| 'logout'
		| 'check-circle'
		| 'eye';

	const MAP: Record<IconName, Component<LucideProps> | null> = {
		home: House,
		compass: Compass,
		search: Search,
		heart: Heart,
		'heart-filled': Heart,
		clock: Clock,
		download: Download,
		settings: Settings,
		user: User,
		play: Play,
		'play-filled': Play,
		pause: Pause,
		plus: Plus,
		check: Check,
		x: X,
		'chevron-left': ChevronLeft,
		'chevron-right': ChevronRight,
		'chevron-down': ChevronDown,
		'chevron-up': ChevronUp,
		star: Star,
		'star-filled': Star,
		share: Share2,
		external: ExternalLink,
		filter: Filter,
		grid: LayoutGrid,
		list: List,
		sliders: SlidersHorizontal,
		volume: Volume2,
		'volume-mute': VolumeX,
		fullscreen: Maximize,
		pip: PictureInPicture,
		subtitles: Captions,
		gauge: Gauge,
		'skip-next': SkipForward,
		'skip-prev': SkipBack,
		trash: Trash2,
		folder: Folder,
		calendar: Calendar,
		sun: Sun,
		moon: Moon,
		globe: Globe,
		command: Command,
		more: MoreHorizontal,
		mail: Mail,
		lock: Lock,
		crown: Crown,
		coin: Coins,
		telegram: null,
		google: null,
		rewind: Rewind,
		forward: FastForward,
		'arrow-right': ArrowRight,
		'arrow-left': ArrowLeft,
		menu: Menu,
		info: Info,
		film: Film,
		tv: Tv,
		flame: Flame,
		trophy: Trophy,
		gift: Gift,
		zap: Zap,
		sparkles: Sparkles,
		medal: Medal,
		shield: Shield,
		ticket: Ticket,
		clapperboard: Clapperboard,
		bell: Bell,
		logout: LogOut,
		'check-circle': CircleCheck,
		eye: Eye
	};

	const FILLED = new Set<IconName>(['heart-filled', 'star-filled', 'play-filled']);
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		size?: number;
		strokeWidth?: number;
		class?: string;
	}
	let { name, size = 20, strokeWidth = 1.8, class: cls = '' }: Props = $props();

	let Cmp = $derived(MAP[name]);
	let fill = $derived(FILLED.has(name) ? 'currentColor' : 'none');
</script>

{#if name === 'google'}
	<!-- brand mark (allowed logo exception) -->
	<svg class={cls} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M21.35 12.23c0-.62-.06-1.22-.16-1.8H12v3.57h5.24a4.48 4.48 0 0 1-1.94 2.94v2.42h3.13c1.83-1.69 2.92-4.18 2.92-7.13z"
			fill="#4285F4"
		/>
		<path
			d="M12 22c2.62 0 4.82-.87 6.43-2.35l-3.13-2.42c-.87.58-1.98.93-3.3.93-2.54 0-4.69-1.71-5.46-4.02H3.3v2.5A9.99 9.99 0 0 0 12 22z"
			fill="#34A853"
		/>
		<path
			d="M6.54 13.14a5.99 5.99 0 0 1 0-3.84v-2.5H3.3a10 10 0 0 0 0 8.84l3.24-2.5z"
			fill="#FBBC05"
		/>
		<path
			d="M12 5.98c1.43 0 2.72.49 3.73 1.46l2.78-2.78A9.95 9.95 0 0 0 12 2 9.99 9.99 0 0 0 3.3 6.8l3.24 2.5C7.31 7 9.46 5.98 12 5.98z"
			fill="#EA4335"
		/>
	</svg>
{:else if name === 'telegram'}
	<!-- brand mark (allowed logo exception) -->
	<svg
		class={cls}
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="currentColor"
		aria-hidden="true"
	>
		<path
			d="M21.94 4.5 2.9 11.84c-1.1.43-1.09 1.05-.2 1.32l4.88 1.52 1.88 5.76c.23.63.4.88.84.88.34 0 .49-.16.68-.34l2.36-2.29 4.9 3.62c.9.5 1.55.24 1.78-.83l3.22-15.2c.33-1.31-.5-1.9-1.98-1.3z"
		/>
	</svg>
{:else if Cmp}
	<Cmp {size} {strokeWidth} class={cls} {fill} aria-hidden="true" />
{/if}
