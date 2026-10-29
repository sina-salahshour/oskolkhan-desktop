/** One row in the download queue (or the offline library when `library`). */
import { motion, useReducedMotion } from 'motion/react';
import { Play, Pause, Trash2, Check } from '@lucide/react';
import { Badge, Progress, IconButton, Button } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { useDownloadsStore, type DownloadItem, type DownloadStatus } from '@/lib/stores/downloads';
import { useI18n } from '@/i18n';
import { formatBytes, formatSpeed, formatDuration, toPercent, toFaDigits } from '@/lib/util/format';
import { cn } from '@/lib/util/cn';

const statusTone: Record<DownloadStatus, BadgeVariant> = {
	downloading: 'accent',
	completed: 'success',
	paused: 'warning',
	queued: 'neutral',
	error: 'danger'
};

export function QueueRow({
	item,
	selecting = false,
	library = false,
	onPlay
}: {
	item: DownloadItem;
	selecting?: boolean;
	library?: boolean;
	onPlay?: (item: DownloadItem) => void;
}) {
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();
	const selected = useDownloadsStore((s) => s.selected.has(item.id));
	const toggleSelect = useDownloadsStore((s) => s.toggleSelect);
	const setStatus = useDownloadsStore((s) => s.setStatus);
	const remove = useDownloadsStore((s) => s.remove);

	const pct = toPercent(item.receivedBytes, item.sizeBytes);
	const statusLabel = t(`downloads.${item.status === 'error' ? 'paused' : item.status}`);
	const remainingBytes = Math.max(0, item.sizeBytes - item.receivedBytes);
	const eta = item.speedBps > 0 ? formatDuration(remainingBytes / item.speedBps, lang) : null;

	const digits = (v: string) => (lang === 'fa' ? toFaDigits(v) : v);

	return (
		<motion.div
			layout={!reduce}
			initial={reduce ? false : { opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.2, ease: 'easeOut' }}
			className={cn(
				'flex items-center gap-4 rounded-xl border p-4 transition-colors',
				selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
			)}
		>
			{selecting ? (
				<button
					type="button"
					role="checkbox"
					aria-checked={selected}
					aria-label={item.title}
					onClick={() => toggleSelect(item.id)}
					className={cn(
						'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
						selected ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong text-transparent'
					)}
				>
					<Check size={13} strokeWidth={3} />
				</button>
			) : null}

			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex items-center gap-3">
					<p className="min-w-0 flex-1 truncate font-semibold text-fg">{item.title}</p>
					{item.group ? (
						<Badge variant="outline" size="sm" className="normal-case">
							{item.group}
						</Badge>
					) : null}
					<Badge variant={statusTone[item.status]} size="sm">
						{statusLabel}
					</Badge>
				</div>

				{library ? (
					<div className="flex gap-4 text-xs text-subtle" dir="ltr">
						<span>{formatBytes(item.sizeBytes, lang)}</span>
					</div>
				) : (
					<>
						<Progress value={pct} size="sm" />
						<div className="flex flex-wrap gap-4 text-xs text-subtle" dir="ltr">
							<span className="font-medium text-muted">{digits(String(pct))}%</span>
							{item.status === 'downloading' ? <span>{formatSpeed(item.speedBps, lang)}</span> : null}
							{item.status === 'downloading' && eta ? (
								<span>
									{t('downloads.remaining')} {eta}
								</span>
							) : null}
							<span>
								{formatBytes(item.receivedBytes, lang)} / {formatBytes(item.sizeBytes, lang)}
							</span>
						</div>
					</>
				)}
			</div>

			<div className="flex shrink-0 items-center gap-2">
				{library ? (
					<Button size="sm" leftIcon={Play} onClick={() => onPlay?.(item)}>
						{t('common.play')}
					</Button>
				) : item.status !== 'completed' ? (
					<IconButton
						variant="subtle"
						size="sm"
						icon={item.status === 'downloading' ? Pause : Play}
						label={item.status === 'downloading' ? t('downloads.pause') : t('downloads.resume')}
						onClick={() => setStatus(item.id, item.status === 'downloading' ? 'paused' : 'downloading')}
					/>
				) : null}
				<IconButton
					variant="ghost"
					size="sm"
					icon={Trash2}
					label={t('common.delete')}
					onClick={() => remove([item.id])}
				/>
			</div>
		</motion.div>
	);
}
