import { ChevronLeft, ChevronRight } from '@lucide/react';
import { motion, useReducedMotion } from 'motion/react';
import { TooltipTip, Icon } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { usePlayerStore } from '../../../lib/stores/player';
import { digits } from '../lib/format';
import { ctlBtn } from './ctl';

export interface TopBarProps {
	onBack: () => void;
}

export function TopBar({ onBack }: TopBarProps) {
	const { t, lang, dir } = useI18n();
	const reduce = useReducedMotion();
	const source = usePlayerStore((s) => s.source);
	const name = source?.title?.persian ?? '';
	const ep = source?.file?.E ? `${t('common.episode')} ${digits(source.file.E, lang)}` : '';
	return (
		<motion.div
			className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-black/60 px-4 py-3"
			initial={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
			animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
			exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
			transition={{ duration: reduce ? 0.1 : 0.2 }}
			onPointerDown={(e) => e.stopPropagation()}
		>
			<TooltipTip label={t('common.back')} side="bottom">
				<button type="button" className={ctlBtn} aria-label={t('common.back')} onClick={onBack}>
					<Icon icon={dir === 'rtl' ? ChevronRight : ChevronLeft} size={22} />
				</button>
			</TooltipTip>
			<div className="flex min-w-0 flex-col leading-tight">
				<b className="truncate text-sm font-semibold">{name}</b>
				{ep ? <small className="text-xs text-white/70">{ep}</small> : null}
			</div>
		</motion.div>
	);
}
