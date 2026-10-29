/**
 * Downloads screen: queue (multi-select bar), download groups, and the offline
 * library. Progress is driven by the mock engine (useDownloadsEngine); the real
 * transfer engine arrives later. Default export = DownloadsScreen (router wires
 * it to /downloads, replacing DownloadsStub).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence } from 'motion/react';
import { Download, Film, FolderPlus, Pause, Play, Trash2, CheckSquare, Plus } from '@lucide/react';
import {
	Button,
	SegmentedControl,
	EmptyState,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter
} from '@/components/ui';
import { useDownloadsStore } from '@/lib/stores/downloads';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { useDownloadsEngine } from './useDownloadsEngine';
import { useGroupsStore } from './groupsStore';
import { QueueRow } from './QueueRow';
import { GroupCard } from './GroupCard';
import { NewGroupDialog } from './NewGroupDialog';

type Tab = 'queue' | 'library' | 'groups';

export default function DownloadsScreen() {
	const { t, lang } = useI18n();
	const navigate = useNavigate();
	useDownloadsEngine();

	const items = useDownloadsStore((s) => s.items);
	const selected = useDownloadsStore((s) => s.selected);
	const setStatus = useDownloadsStore((s) => s.setStatus);
	const remove = useDownloadsStore((s) => s.remove);
	const pauseAll = useDownloadsStore((s) => s.pauseAll);
	const resumeAll = useDownloadsStore((s) => s.resumeAll);
	const clearSelection = useDownloadsStore((s) => s.clearSelection);

	const groups = useGroupsStore((s) => s.groups);

	const [tab, setTab] = useState<Tab>('queue');
	const [selecting, setSelecting] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [groupOpen, setGroupOpen] = useState(false);

	const queue = useMemo(() => items.filter((i) => i.status !== 'completed'), [items]);
	const library = useMemo(() => items.filter((i) => i.status === 'completed'), [items]);
	const selectedQueueIds = useMemo(() => queue.filter((q) => selected.has(q.id)).map((q) => q.id), [queue, selected]);
	const allSelected = queue.length > 0 && selectedQueueIds.length === queue.length;

	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	function toggleSelecting() {
		setSelecting((v) => {
			if (v) clearSelection();
			return !v;
		});
	}
	function toggleAll() {
		if (allSelected) clearSelection();
		else useDownloadsStore.setState({ selected: new Set(queue.map((q) => q.id)) });
	}
	function startSelected() {
		selectedQueueIds.forEach((id) => {
			const it = items.find((x) => x.id === id);
			if (it && it.status !== 'downloading') setStatus(id, 'downloading');
		});
	}
	function stopSelected() {
		selectedQueueIds.forEach((id) => setStatus(id, 'paused'));
	}
	function confirmDelete() {
		remove(selectedQueueIds);
		setConfirmOpen(false);
		setSelecting(false);
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-2xl font-extrabold text-fg">{t('downloads.title')}</h1>
				<SegmentedControl
					value={tab}
					onValueChange={(v) => setTab(v as Tab)}
					aria-label={t('downloads.title')}
					options={[
						{ value: 'queue', label: `${t('downloads.queue')} (${digit(queue.length)})`, icon: Download },
						{ value: 'library', label: t('downloads.library'), icon: Film },
						{ value: 'groups', label: t('downloads.groups'), icon: FolderPlus }
					]}
				/>
			</div>

			{tab === 'queue' ? (
				<>
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="subtle" size="sm" leftIcon={Pause} onClick={pauseAll}>
							{t('downloads.pauseAll')}
						</Button>
						<Button variant="subtle" size="sm" leftIcon={Play} onClick={resumeAll}>
							{t('downloads.resumeAll')}
						</Button>
						<span className="flex-1" />
						{selecting ? (
							<>
								<Button variant="ghost" size="sm" onClick={toggleAll} disabled={queue.length === 0}>
									{allSelected ? t('common.clear') : t('common.selectAll')}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									leftIcon={Play}
									disabled={selectedQueueIds.length === 0}
									onClick={startSelected}
								>
									{t('downloads.resume')}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									leftIcon={Pause}
									disabled={selectedQueueIds.length === 0}
									onClick={stopSelected}
								>
									{t('downloads.pause')}
								</Button>
								<Button
									variant="danger"
									size="sm"
									leftIcon={Trash2}
									disabled={selectedQueueIds.length === 0}
									onClick={() => setConfirmOpen(true)}
								>
									{t('downloads.deleteSelected')}
									{selectedQueueIds.length > 0 ? ` (${digit(selectedQueueIds.length)})` : ''}
								</Button>
							</>
						) : null}
						<Button
							variant={selecting ? 'solid' : 'outline'}
							size="sm"
							leftIcon={CheckSquare}
							onClick={toggleSelecting}
						>
							{selecting ? t('common.cancel') : t('list.multiDelete')}
						</Button>
					</div>

					{queue.length === 0 ? (
						<EmptyState icon={Download} title={t('downloads.empty')} />
					) : (
						<div className="flex flex-col gap-3">
							<AnimatePresence initial={false}>
								{queue.map((item) => (
									<QueueRow key={item.id} item={item} selecting={selecting} />
								))}
							</AnimatePresence>
						</div>
					)}
				</>
			) : null}

			{tab === 'library' ? (
				library.length === 0 ? (
					<EmptyState icon={Film} title={t('downloads.libraryEmpty')} />
				) : (
					<div className="flex flex-col gap-3">
						<AnimatePresence initial={false}>
							{library.map((item) => (
								<QueueRow key={item.id} item={item} library onPlay={() => navigate({ to: '/player' })} />
							))}
						</AnimatePresence>
					</div>
				)
			) : null}

			{tab === 'groups' ? (
				<>
					<div className="flex items-center justify-end">
						<Button size="sm" leftIcon={Plus} onClick={() => setGroupOpen(true)}>
							{t('downloads.newGroup')}
						</Button>
					</div>
					{groups.length === 0 ? (
						<EmptyState icon={FolderPlus} title={t('downloads.groups')} description={t('downloads.newGroup')} />
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
							{groups.map((g) => (
								<GroupCard key={g.id} group={g} />
							))}
						</div>
					)}
				</>
			) : null}

			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>{t('downloads.deleteSelected')}</DialogTitle>
						<DialogDescription>
							{digit(selectedQueueIds.length)} {t('common.selected')}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmOpen(false)}>
							{t('common.cancel')}
						</Button>
						<Button variant="danger" leftIcon={Trash2} onClick={confirmDelete}>
							{t('common.confirm')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<NewGroupDialog open={groupOpen} onOpenChange={setGroupOpen} />
		</div>
	);
}
