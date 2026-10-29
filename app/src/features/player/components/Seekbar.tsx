import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useReducedMotion } from 'motion/react';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import { timecode } from '../lib/format';

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

	return (
		<div dir="ltr" className="group relative w-full py-2">
			{active ? (
				<div
					className="pointer-events-none absolute bottom-full flex -translate-x-1/2 flex-col items-center gap-1.5"
					style={{ left: `${hoverRatio * 100}%` }}
				>
					{/* thumbnail preview placeholder (real frames come with the real PlaybackSource) */}
					<div className="grid h-[84px] w-[150px] place-items-center rounded-md border border-white/20 bg-black/80 shadow-lg">
						<span className="text-xs text-white/60">{timecode(hoverRatio * duration, lang)}</span>
					</div>
					<div className="rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">
						{timecode(hoverRatio * duration, lang)}
					</div>
				</div>
			) : null}
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
