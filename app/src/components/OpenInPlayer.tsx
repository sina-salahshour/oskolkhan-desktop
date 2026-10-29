/**
 * "Open in external player" control: a small button that pops a list of the
 * media players detected on the host (mpv, VLC, …) and launches the file's local
 * `/stream` URL in the chosen one. External players decode everything natively
 * (MKV/HEVC/AC3/DTS, all audio + subtitle tracks), so this is the high-fidelity
 * escape hatch from the in-app HLS transcode.
 *
 * Hidden when no players are installed or the core asset server isn't up yet, and
 * for external/trailer urns (those are http links opened in the browser elsewhere).
 */
import { useState } from 'react';
import { MonitorPlay } from '@lucide/react';
import { IconButton, Popover, PopoverContent, PopoverTrigger } from './ui';
import { useSessionStore } from '../lib/stores/session';
import { useToastStore } from '../lib/stores/toast';
import { useI18n } from '../i18n';
import { cn } from '../lib/util/cn';
import type { FileV2 } from '../lib/api/types';
import type { IconButtonSize } from './ui';

export function OpenInPlayer({ file, size = 'sm' }: { file: FileV2; size?: IconButtonSize }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const push = useToastStore((s) => s.push);
	const assetBase = useSessionStore((s) => s.assetBase());
	const players = window.oskol?.players ?? [];

	// Nothing to open with, no stream yet, or an external-link (trailer) urn.
	if (players.length === 0 || !assetBase || /^https?:\/\//i.test(file.urn)) return null;

	const url = `${assetBase}/stream?urn=${encodeURIComponent(file.urn)}&id=${file.id}`;
	const launch = (id: string, name: string) => {
		setOpen(false);
		void window.oskol?.openInPlayer(id, url).then((ok) => {
			push(ok ? { tone: 'success', title: name } : { tone: 'info', title: t('item.linkFailed') });
		});
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<IconButton icon={MonitorPlay} label={t('common.openExternal')} size={size} />
			</PopoverTrigger>
			<PopoverContent side="top" align="end" className="w-52 p-1.5">
				<p className="px-2.5 pb-1 pt-0.5 text-xs font-medium text-muted">{t('common.openExternal')}</p>
				{players.map((p) => (
					<button
						key={p.id}
						type="button"
						onClick={() => launch(p.id, p.name)}
						className={cn(
							'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-fg',
							'outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
						)}
					>
						<MonitorPlay size={16} className="text-muted" />
						<span className="truncate">{p.name}</span>
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
