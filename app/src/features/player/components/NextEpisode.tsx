import { SkipForward } from '@lucide/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { digits } from '../lib/format';
import { usePlayerChrome } from '../store';

export interface NextEpisodeProps {
	onPlayNow: () => void;
	onCancel: () => void;
}

export function NextEpisode({ onPlayNow, onCancel }: NextEpisodeProps) {
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();
	const countdown = usePlayerChrome((s) => s.nextCountdown);
	return (
		<AnimatePresence>
			{countdown != null ? (
				<motion.div
					key="next"
					className="absolute bottom-28 end-6 z-20 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-fg shadow-lg"
					initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
					animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
					exit={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
					transition={{ duration: reduce ? 0.1 : 0.22 }}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<p className="text-sm">{t('player.nextIn', { n: digits(countdown, lang) })}</p>
					<div className="flex gap-2">
						<Button size="sm" leftIcon={SkipForward} onClick={onPlayNow}>
							{t('player.playNow')}
						</Button>
						<Button size="sm" variant="ghost" onClick={onCancel}>
							{t('player.cancel')}
						</Button>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>
	);
}
