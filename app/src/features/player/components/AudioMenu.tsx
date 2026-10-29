import { Volume2, Check, Folder } from '@lucide/react';
import { Popover, PopoverContent, PopoverTrigger, Icon, Slider, TooltipTip } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import { digits } from '../lib/format';
import { usePlayerChrome } from '../store';
import { ctlBtn, menuRow, menuRowGhost, menuRowOn } from './ctl';

export interface AudioMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Switch audio track (reloads the stream with that track). */
	onSelect: (id: string) => void;
}

export function AudioMenu({ open, onOpenChange, onSelect }: AudioMenuProps) {
	const { t, lang } = useI18n();
	const tracks = usePlayerChrome((s) => s.audioTracks);
	const trackId = usePlayerChrome((s) => s.audioTrackId);
	const delay = usePlayerChrome((s) => s.audioDelayMs);
	const patch = usePlayerChrome((s) => s.patch);
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<TooltipTip label={t('player.audioTrack')}>
				<PopoverTrigger asChild>
					<button type="button" className={ctlBtn} aria-label={t('player.audioTrack')}>
						<Icon icon={Volume2} size={19} />
					</button>
				</PopoverTrigger>
			</TooltipTip>
			<PopoverContent side="top" align="end" className="w-64 p-2">
				<p className="px-2.5 pb-1.5 text-xs font-medium text-muted">{t('player.audioTrack')}</p>
				{tracks.map((a) => (
					<button
						key={a.id}
						type="button"
						className={cn(menuRow, trackId === a.id && menuRowOn)}
						onClick={() => onSelect(a.id)}
					>
						<span>{a.label}</span>
						{trackId === a.id ? <Icon icon={Check} size={16} /> : null}
					</button>
				))}
				<button type="button" className={cn(menuRow, menuRowGhost, 'justify-start')}>
					<Icon icon={Folder} size={16} />
					{t('player.externalAudio')}
				</button>
				<div className="my-2 h-px bg-line" />
				<div className="space-y-2 px-2.5 pb-1">
					<div className="flex items-center justify-between text-xs text-muted">
						<span>{t('player.audioDelay')}</span>
						<span dir="ltr">{digits(delay, lang)}ms</span>
					</div>
					<Slider
						size="sm"
						min={-5000}
						max={5000}
						step={50}
						value={[delay]}
						aria-label={t('player.audioDelay')}
						onValueChange={(v: number[]) => patch({ audioDelayMs: v[0] ?? 0 })}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
