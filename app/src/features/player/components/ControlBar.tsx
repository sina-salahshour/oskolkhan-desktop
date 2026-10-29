import { useEffect, useState } from 'react';
import {
	FastForward,
	Lock,
	LockOpen,
	Maximize,
	Minimize,
	Pause,
	PictureInPicture2,
	Play,
	Rewind,
	SkipForward,
	Volume1,
	Volume2,
	VolumeX,
} from '@lucide/react';
import { motion, useReducedMotion } from 'motion/react';
import { Icon, Slider, TooltipTip } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import { usePlayerStore } from '../../../lib/stores/player';
import type { PlayerController } from '../hooks/usePlayerController';
import { timecode } from '../lib/format';
import { usePlayerChrome } from '../store';
import { AudioMenu } from './AudioMenu';
import { ctlBtn } from './ctl';
import { Seekbar } from './Seekbar';
import { SpeedMenu } from './SpeedMenu';
import { SubtitleMenu } from './SubtitleMenu';

export interface ControlBarProps {
	controller: PlayerController;
	onToggleFullscreen: () => void;
	/** reports whether any popover menu is open (keeps the bar visible) */
	onMenuOpenChange: (anyOpen: boolean) => void;
}

export function ControlBar({ controller, onToggleFullscreen, onMenuOpenChange }: ControlBarProps) {
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();
	const position = usePlayerStore((s) => s.position);
	const duration = usePlayerStore((s) => s.duration);
	const volume = usePlayerStore((s) => s.volume);
	const muted = usePlayerStore((s) => s.muted);
	const fullscreen = usePlayerStore((s) => s.fullscreen);
	const status = usePlayerChrome((s) => s.status);
	const buffered = usePlayerChrome((s) => s.buffered);
	const lock = usePlayerChrome((s) => s.lock);
	const pip = usePlayerChrome((s) => s.pip);
	const hasNext = usePlayerChrome((s) => s.index < s.playlist.length - 1);

	const [speedOpen, setSpeedOpen] = useState(false);
	const [audioOpen, setAudioOpen] = useState(false);
	const [subsOpen, setSubsOpen] = useState(false);
	const anyOpen = speedOpen || audioOpen || subsOpen;
	useEffect(() => {
		onMenuOpenChange(anyOpen);
	}, [anyOpen, onMenuOpenChange]);

	const playing = status === 'playing';
	const silent = muted || volume === 0;
	const volIcon = silent ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

	const tip = (label: string, node: React.ReactElement) => <TooltipTip label={label}>{node}</TooltipTip>;

	return (
		<motion.div
			className="absolute inset-x-0 bottom-0 z-20 bg-black/70 px-4 pb-3 pt-2"
			initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
			animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
			exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
			transition={{ duration: reduce ? 0.1 : 0.22 }}
			onPointerDown={(e) => e.stopPropagation()}
		>
			{lock ? (
				<div className="flex justify-center py-1">
					{tip(
						'Unlock',
						<button type="button" className={cn(ctlBtn, 'bg-white/15')} aria-label="Unlock" onClick={controller.toggleLock}>
							<Icon icon={Lock} size={20} />
						</button>,
					)}
				</div>
			) : (
				<>
					<Seekbar position={position} duration={duration} buffered={buffered} onSeek={controller.seek} />
					<div className="flex items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-1">
							{tip(
								t('common.play'),
								<button type="button" className={ctlBtn} aria-label={t('common.play')} onClick={controller.togglePlay}>
									<Icon icon={playing ? Pause : Play} size={24} />
								</button>,
							)}
							{tip(
								'-10s',
								<button type="button" className={ctlBtn} aria-label="-10s" onClick={() => controller.seekBy(-10)}>
									<Icon icon={Rewind} size={20} />
								</button>,
							)}
							{tip(
								'+10s',
								<button type="button" className={ctlBtn} aria-label="+10s" onClick={() => controller.seekBy(10)}>
									<Icon icon={FastForward} size={20} />
								</button>,
							)}
							{hasNext
								? tip(
										t('player.nextEpisode'),
										<button
											type="button"
											className={ctlBtn}
											aria-label={t('player.nextEpisode')}
											onClick={() => void controller.playNext()}
										>
											<Icon icon={SkipForward} size={20} />
										</button>,
									)
								: null}
							<div className="flex items-center gap-1">
								{tip(
									t('player.audio'),
									<button type="button" className={ctlBtn} aria-label={t('player.audio')} onClick={controller.toggleMute}>
										<Icon icon={volIcon} size={20} />
									</button>,
								)}
								<div className="w-20">
									<Slider
										size="sm"
										min={0}
										max={1}
										step={0.05}
										value={[silent ? 0 : volume]}
										aria-label={t('player.audio')}
										onValueChange={(v: number[]) => controller.setVolume(v[0] ?? 0)}
									/>
								</div>
							</div>
							<span className="ms-2 whitespace-nowrap text-xs text-white/80" dir="ltr">
								{timecode(position, lang)} / {timecode(duration, lang)}
							</span>
						</div>
						<div className="flex items-center gap-1">
							<SpeedMenu open={speedOpen} onOpenChange={setSpeedOpen} onSelect={controller.setRate} />
							<AudioMenu open={audioOpen} onOpenChange={setAudioOpen} />
							<SubtitleMenu open={subsOpen} onOpenChange={setSubsOpen} />
							{tip(
								'Lock',
								<button type="button" className={ctlBtn} aria-label="Lock" onClick={controller.toggleLock}>
									<Icon icon={LockOpen} size={19} />
								</button>,
							)}
							{tip(
								t('player.pip'),
								<button
									type="button"
									className={cn(ctlBtn, pip && 'bg-white/15 text-accent')}
									aria-label={t('player.pip')}
									aria-pressed={pip}
									onClick={controller.togglePip}
								>
									<Icon icon={PictureInPicture2} size={19} />
								</button>,
							)}
							{tip(
								t('player.fullscreen'),
								<button type="button" className={ctlBtn} aria-label={t('player.fullscreen')} onClick={onToggleFullscreen}>
									<Icon icon={fullscreen ? Minimize : Maximize} size={19} />
								</button>,
							)}
						</div>
					</div>
				</>
			)}
		</motion.div>
	);
}
