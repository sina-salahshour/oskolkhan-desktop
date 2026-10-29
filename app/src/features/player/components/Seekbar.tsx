import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import Hls from 'hls.js';
import { useReducedMotion } from 'motion/react';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import { timecode } from '../lib/format';
import { usePlayerChrome } from '../store';

export interface SeekbarProps {
	position: number;
	duration: number;
	buffered: number;
	onSeek: (seconds: number) => void;
}

export function Seekbar({ position, duration, buffered, onSeek }: SeekbarProps) {
	const { lang } = useI18n();
	const reduce = useReducedMotion();
	const bar = useRef<HTMLDivElement>(null);
	const [hovering, setHovering] = useState(false);
	const [hoverRatio, setHoverRatio] = useState(0);
	const [dragging, setDragging] = useState(false);
	const thumbBase = usePlayerChrome((s) => s.thumbBase);
	const sbInterval = usePlayerChrome((s) => s.storyboardInterval);
	const sbCount = usePlayerChrome((s) => s.storyboardCount);
	const playlistUrl = usePlayerChrome((s) => s.playlistUrl);

	// A hidden second player for the live-frame preview over already-loaded ranges.
	const previewVideo = useRef<HTMLVideoElement>(null);
	const previewHls = useRef<Hls | null>(null);
	const [previewReady, setPreviewReady] = useState(false);

	useEffect(() => {
		setPreviewReady(false);
		const video = previewVideo.current;
		if (!video || !playlistUrl || !Hls.isSupported()) return;
		const hls = new Hls({ enableWorker: true, maxBufferLength: 8, maxMaxBufferLength: 16 });
		previewHls.current = hls;
		const onReady = () => setPreviewReady(true);
		hls.on(Hls.Events.MANIFEST_PARSED, onReady);
		hls.loadSource(playlistUrl);
		hls.attachMedia(video);
		return () => {
			hls.destroy();
			previewHls.current = null;
			setPreviewReady(false);
		};
	}, [playlistUrl]);

	const playedPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
	const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

	const ratioAt = (clientX: number): number => {
		const el = bar.current;
		if (!el) return 0;
		const r = el.getBoundingClientRect();
		if (r.width <= 0) return 0;
		return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
	};

	const onMove = (e: PointerEvent<HTMLDivElement>) => {
		const r = ratioAt(e.clientX);
		setHoverRatio(r);
		if (dragging) onSeek(r * duration);
	};
	const onDown = (e: PointerEvent<HTMLDivElement>) => {
		e.stopPropagation();
		setDragging(true);
		bar.current?.setPointerCapture(e.pointerId);
		onSeek(ratioAt(e.clientX) * duration);
	};
	const onUp = (e: PointerEvent<HTMLDivElement>) => {
		setDragging(false);
		if (bar.current?.hasPointerCapture(e.pointerId)) bar.current.releasePointerCapture(e.pointerId);
	};
	const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
		if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
			e.preventDefault();
			e.stopPropagation();
			onSeek(position + 5);
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
			e.preventDefault();
			e.stopPropagation();
			onSeek(position - 5);
		}
	};

	const active = hovering || dragging;
	const trans = reduce ? '' : 'transition-all duration-150';

	const hoverTime = hoverRatio * duration;
	// Clamp the preview to the bar so it doesn't overflow the viewport edges.
	const clampedLeft = Math.min(94, Math.max(6, hoverRatio * 100));

	// Storyboard frame index for the hovered time. The frames are pre-generated in
	// the background, so hovering is instant once they exist; a short debounce avoids
	// hammering not-yet-generated frames during a fast drag. The timecode tracks live.
	const sbIdx =
		active && sbInterval > 0 && sbCount > 0 && Number.isFinite(hoverTime)
			? Math.min(sbCount - 1, Math.max(0, Math.round(hoverTime / sbInterval)))
			: -1;
	const [committedIdx, setCommittedIdx] = useState(-1);
	useEffect(() => {
		if (sbIdx < 0) return;
		const id = setTimeout(() => setCommittedIdx(sbIdx), 60);
		return () => clearTimeout(id);
	}, [sbIdx]);
	const thumbUrl =
		active && thumbBase && committedIdx >= 0
			? `${thumbBase}/sb${String(committedIdx).padStart(5, '0')}.jpg`
			: null;

	// Live-frame preview over the already-loaded (buffered) range: seek the hidden
	// player to the hovered time so we show the real decoded frame there. Debounced
	// so a fast drag doesn't thrash the seek. Beyond the buffer we keep the storyboard.
	const loaded = active && duration > 0 && hoverTime <= buffered + 0.5;
	const [seekTime, setSeekTime] = useState(-1);
	useEffect(() => {
		if (!loaded) {
			setSeekTime(-1);
			return;
		}
		const id = setTimeout(() => setSeekTime(hoverTime), 70);
		return () => clearTimeout(id);
	}, [loaded, hoverTime]);
	useEffect(() => {
		const v = previewVideo.current;
		if (!v || !previewReady || seekTime < 0) return;
		try {
			v.currentTime = seekTime;
		} catch {
			/* ignore */
		}
	}, [seekTime, previewReady]);
	const showLive = loaded && previewReady && seekTime >= 0;

	return (
		<div dir="ltr" className="group relative w-full py-2">
			{/* The preview box stays mounted (so the hidden <video> keeps its hls.js
			    attached) and is just hidden when not hovering. */}
			<div
				className="pointer-events-none absolute bottom-full flex -translate-x-1/2 flex-col items-center gap-1.5"
				style={{ left: `${clampedLeft}%`, visibility: active ? 'visible' : 'hidden' }}
			>
				<div className="relative grid h-[84px] w-[150px] place-items-center overflow-hidden rounded-md border border-white/20 bg-black/80 shadow-lg">
					{/* Timecode behind; storyboard frame over it; live video on top for
					    loaded ranges. */}
					<span className="text-xs text-white/50">{timecode(hoverTime, lang)}</span>
					{thumbUrl ? (
						<img
							key={thumbUrl}
							src={thumbUrl}
							alt=""
							draggable={false}
							onError={(e) => {
								e.currentTarget.style.visibility = 'hidden';
							}}
							className="absolute inset-0 h-full w-full object-cover"
						/>
					) : null}
					<video
						ref={previewVideo}
						muted
						playsInline
						preload="auto"
						className="absolute inset-0 h-full w-full object-cover"
						style={{ visibility: showLive ? 'visible' : 'hidden' }}
					/>
				</div>
				<div className="rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">{timecode(hoverTime, lang)}</div>
			</div>
			<div
				ref={bar}
				role="slider"
				tabIndex={0}
				aria-label="seek"
				aria-valuemin={0}
				aria-valuemax={Math.round(duration)}
				aria-valuenow={Math.round(position)}
				aria-valuetext={timecode(position, lang)}
				onPointerDown={onDown}
				onPointerMove={onMove}
				onPointerUp={onUp}
				onPointerCancel={onUp}
				onPointerEnter={() => setHovering(true)}
				onPointerLeave={() => setHovering(false)}
				onKeyDown={onKey}
				className={cn(
					'relative h-1.5 cursor-pointer touch-none rounded-full bg-white/20 hover:h-2',
					'focus-visible:h-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
					trans,
				)}
			>
				<div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
				<div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${playedPct}%` }} />
				<div
					className={cn(
						'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0',
						'group-hover:opacity-100 group-focus-within:opacity-100',
						active && 'opacity-100',
						trans,
					)}
					style={{ left: `${playedPct}%` }}
				/>
			</div>
		</div>
	);
}
