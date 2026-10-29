import { Gauge, Check } from '@lucide/react';
import { Popover, PopoverContent, PopoverTrigger, Icon, TooltipTip } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { usePlayerStore } from '../../../lib/stores/player';
import { SPEEDS } from '../lib/playback';
import { digits } from '../lib/format';
import { cn } from '../../../lib/util/cn';
import { ctlBtn, menuRow, menuRowOn } from './ctl';

export interface SpeedMenuProps {
	onSelect: (rate: number) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function SpeedMenu({ onSelect, onOpenChange, open }: SpeedMenuProps) {
	const { t, lang } = useI18n();
	const rate = usePlayerStore((s) => s.rate);
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<TooltipTip label={t('player.speed')}>
				<PopoverTrigger asChild>
					<button type="button" className={ctlBtn} aria-label={t('player.speed')}>
						<Icon icon={Gauge} size={19} />
						<span>{digits(rate, lang)}×</span>
					</button>
				</PopoverTrigger>
			</TooltipTip>
			<PopoverContent side="top" align="end" className="w-44 p-2">
				<p className="px-2.5 pb-1.5 text-xs text-muted">{t('player.holdFor2x')}</p>
				{SPEEDS.map((s) => (
					<button
						key={s}
						type="button"
						className={cn(menuRow, rate === s && menuRowOn)}
						onClick={() => {
							onSelect(s);
							onOpenChange(false);
						}}
					>
						<span>{digits(s, lang)}×</span>
						{rate === s ? <Icon icon={Check} size={16} /> : null}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
