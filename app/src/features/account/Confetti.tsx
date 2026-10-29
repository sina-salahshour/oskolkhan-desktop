/**
 * A tasteful, restrained confetti burst for the level-up moment. Uses the one
 * accent plus success/warning tokens (no rainbow), auto-clears, and renders
 * nothing under prefers-reduced-motion.
 */
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const COLORS = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--fg)'];

interface Piece {
	id: number;
	x: number;
	rotate: number;
	delay: number;
	color: string;
	drift: number;
}

export function Confetti({ fireKey }: { fireKey: number }) {
	const reduce = useReducedMotion();
	const [pieces, setPieces] = useState<Piece[]>([]);

	useEffect(() => {
		if (!fireKey || reduce) return;
		const next: Piece[] = Array.from({ length: 24 }, (_, i) => ({
			id: fireKey * 100 + i,
			x: 50 + (Math.random() - 0.5) * 60,
			rotate: Math.random() * 360,
			delay: Math.random() * 0.15,
			color: COLORS[i % COLORS.length],
			drift: (Math.random() - 0.5) * 40
		}));
		setPieces(next);
		const timer = setTimeout(() => setPieces([]), 1400);
		return () => clearTimeout(timer);
	}, [fireKey, reduce]);

	if (pieces.length === 0) return null;

	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
			{pieces.map((p) => (
				<motion.span
					key={p.id}
					className="absolute top-1/3 h-2.5 w-1.5 rounded-[1px]"
					style={{ left: `${p.x}%`, backgroundColor: p.color }}
					initial={{ opacity: 1, y: 0, rotate: p.rotate, scale: 1 }}
					animate={{ opacity: 0, y: 220, x: p.drift, rotate: p.rotate + 220, scale: 0.6 }}
					transition={{ duration: 1.2, delay: p.delay, ease: 'easeOut' }}
				/>
			))}
		</div>
	);
}
