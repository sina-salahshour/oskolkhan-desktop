/**
 * Per-file download control for the file tree.
 * - Idle: a download icon. If no download groups exist, clicking starts the
 *   transfer straight into the app's default folder. If groups exist, clicking
 *   opens a small popover to choose which group (folder) to download into.
 * - Active: a progress ring that fills with the percent; hovering reveals an ✕ and
 *   clicking cancels (the downloader is start+cancel only — no pause/resume yet).
 * Either way a "download started" toast fires.
 */
import { useState } from 'react';
import { Download, Folder, X } from '@lucide/react';
import { IconButton, Popover, PopoverContent, PopoverTrigger } from '../../../components/ui';
import { useDownloadsStore } from '../../../lib/stores/downloads';
import { useGroupsStore } from '../../downloads/groupsStore';
import { useToastStore } from '../../../lib/stores/toast';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import type { FileV2 } from '../../../lib/api/types';

export interface DownloadStartOpts {
	destDir?: string;
	groupName?: string;
}

function ProgressRing({ percent, label, onClick }: { percent: number; label: string; onClick: () => void }) {
	const r = 8;
	const circ = 2 * Math.PI * r;
	const offset = circ - (Math.max(0, Math.min(100, percent)) / 100) * circ;
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className="group relative grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-2"
		>
			<svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
				<circle cx="10" cy="10" r={r} fill="none" strokeWidth="2.5" stroke="currentColor" className="text-line" />
				<circle
					cx="10"
					cy="10"
					r={r}
					fill="none"
					strokeWidth="2.5"
					strokeLinecap="round"
					stroke="currentColor"
					strokeDasharray={circ}
					strokeDashoffset={offset}
					className="text-accent transition-[stroke-dashoffset] duration-300"
				/>
			</svg>
			<span className="absolute text-[9px] font-semibold tabular-nums text-fg group-hover:opacity-0">
				{Math.round(percent)}
			</span>
			<X size={11} className="absolute text-fg opacity-0 group-hover:opacity-100" />
		</button>
	);
}

export function DownloadButton({ file, onStart }: { file: FileV2; onStart: (opts?: DownloadStartOpts) => void }) {
	const { t } = useI18n();
	const push = useToastStore((s) => s.push);
	const cancel = useDownloadsStore((s) => s.cancel);
	const groups = useGroupsStore((s) => s.groups);
	const [pickOpen, setPickOpen] = useState(false);
	const active = useDownloadsStore((s) =>
		s.items.find((it) => it.fileId === file.id && (it.status === 'downloading' || it.status === 'queued')),
	);

	if (active) {
		const pct = active.sizeBytes > 0 ? (active.receivedBytes / active.sizeBytes) * 100 : 0;
		return <ProgressRing percent={pct} label={t('common.cancel')} onClick={() => cancel(active.id)} />;
	}

	const start = (opts?: DownloadStartOpts) => {
		onStart(opts);
		push({ tone: 'success', title: t('downloads.started') });
	};

	// No groups: download straight into the app's default folder.
	if (groups.length === 0) {
		return <IconButton icon={Download} label={t('common.download')} size="sm" onClick={() => start()} />;
	}

	// Groups exist: ask which group (folder) to use.
	return (
		<Popover open={pickOpen} onOpenChange={setPickOpen}>
			<PopoverTrigger asChild>
				<IconButton icon={Download} label={t('common.download')} size="sm" />
			</PopoverTrigger>
			<PopoverContent side="top" align="end" className="w-56 p-1.5">
				<p className="px-2.5 pb-1 pt-0.5 text-xs font-medium text-muted">{t('downloads.chooseGroup')}</p>
				{groups.map((g) => (
					<button
						key={g.id}
						type="button"
						onClick={() => {
							setPickOpen(false);
							start({ destDir: g.folder, groupName: g.name });
						}}
						className={cn(
							'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-start text-sm text-fg',
							'outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2',
						)}
					>
						<Folder size={16} className="shrink-0 text-muted" />
						<span className="min-w-0 flex-1">
							<span className="block truncate">{g.name}</span>
							{g.folder ? <span className="block truncate text-xs text-subtle" dir="ltr">{g.folder}</span> : null}
						</span>
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
