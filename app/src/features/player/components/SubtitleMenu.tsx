import { Captions, Check, ExternalLink, Folder, Gauge, SlidersHorizontal } from '@lucide/react';
import { Popover, PopoverContent, PopoverTrigger, Icon, TooltipTip } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import { usePlayerChrome, type PanelKind } from '../store';
import { ctlBtn, menuRow, menuRowGhost, menuRowOn } from './ctl';

export interface SubtitleMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SubtitleMenu({ open, onOpenChange }: SubtitleMenuProps) {
	const { t } = useI18n();
	const tracks = usePlayerChrome((s) => s.subtitleTracks);
	const trackId = usePlayerChrome((s) => s.subtitleTrackId);
	const patch = usePlayerChrome((s) => s.patch);
	const openPanel = (panel: PanelKind) => {
		patch({ panel });
		onOpenChange(false);
	};
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			<TooltipTip label={t('player.subtitles')}>
				<PopoverTrigger asChild>
					<button type="button" className={ctlBtn} aria-label={t('player.subtitles')}>
						<Icon icon={Captions} size={20} />
					</button>
				</PopoverTrigger>
			</TooltipTip>
			<PopoverContent side="top" align="end" className="w-64 p-2">
				<p className="px-2.5 pb-1.5 text-xs font-medium text-muted">{t('player.subtitles')}</p>
				<button
					type="button"
					className={cn(menuRow, trackId === null && menuRowOn)}
					onClick={() => patch({ subtitleTrackId: null })}
				>
					<span>{t('common.none')}</span>
					{trackId === null ? <Icon icon={Check} size={16} /> : null}
				</button>
				{tracks.map((s) => {
					// Image-based subs (PGS/VOBSUB) can't be rendered as text — show
					// them disabled with a hint rather than silently doing nothing.
					const renderable = s.text !== false;
					return (
						<button
							key={s.id}
							type="button"
							disabled={!renderable}
							className={cn(menuRow, trackId === s.id && menuRowOn, !renderable && 'cursor-not-allowed opacity-50')}
							onClick={() => renderable && patch({ subtitleTrackId: s.id })}
						>
							<span>
								{s.label}
								{!renderable ? ` · ${t('player.imageSub')}` : ''}
							</span>
							{trackId === s.id ? <Icon icon={Check} size={16} /> : null}
						</button>
					);
				})}
				<button type="button" className={cn(menuRow, menuRowGhost, 'justify-start')}>
					<Icon icon={Folder} size={16} />
					{t('player.loadSubtitle')}
				</button>
				<button type="button" className={cn(menuRow, menuRowGhost, 'justify-start')}>
					<Icon icon={ExternalLink} size={16} />
					{t('player.lanUpload')}
				</button>
				<div className="my-2 h-px bg-line" />
				<button type="button" className={cn(menuRow, 'justify-start')} onClick={() => openPanel('style')}>
					<Icon icon={SlidersHorizontal} size={16} />
					{t('player.subtitleStyle')}
				</button>
				<button type="button" className={cn(menuRow, 'justify-start')} onClick={() => openPanel('sync')}>
					<Icon icon={Gauge} size={16} />
					{t('player.subtitleSync')}
				</button>
			</PopoverContent>
		</Popover>
	);
}
