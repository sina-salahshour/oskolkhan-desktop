/**
 * Shared managed title list for Likes & History: grid/list views, multi-select
 * with bulk delete (confirm dialog), infinite "load more", resume progress for
 * history, and empty/error/loading states. Errors from the delete mutation flow
 * through the global toast (MutationCache) automatically.
 */
import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from '@tanstack/react-router';
import { LayoutGrid, List as ListIcon, Trash2, CheckSquare, Check, X, Play } from '@lucide/react';
import type { LucideIcon } from '@lucide/react';
import {
	Button,
	SegmentedControl,
	EmptyState,
	ErrorState,
	Skeleton,
	Progress,
	Icon,
	Badge,
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter
} from '@/components/ui';
import type { GenericTitle } from '@/lib/api';
import { isApiError } from '@/lib/api';
import type { useLikes } from '@/lib/query';
import { useI18n } from '@/i18n';
import { toFaDigits } from '@/lib/util/format';
import { useSessionStore } from '@/lib/stores/session';
import { poster, placeholderColor } from '@/lib/util/images';
import { useSettingsStore } from '@/features/settings/store';
import { cn } from '@/lib/util/cn';
import { TitleCard } from './TitleCard';

type InfiniteTitleQuery = ReturnType<typeof useLikes>;

/** Pseudo resume progress (history), deterministic per id — real sync lands later. */
export function resumeProgress(id: number): number {
	return 0.2 + (id % 5) * 0.15;
}

export interface LibraryListProps {
	heading: string;
	emptyIcon: LucideIcon;
	emptyTitle: string;
	query: InfiniteTitleQuery;
	/** remove a single id (likes → like(off); history → removeWatch). */
	onRemove: (id: number) => Promise<unknown>;
	showProgress?: boolean;
}

export function LibraryList({ heading, emptyIcon, emptyTitle, query, onRemove, showProgress = false }: LibraryListProps) {
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();

	const [view, setView] = useState<'grid' | 'list'>('grid');
	const [selectMode, setSelectMode] = useState(false);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [removed, setRemoved] = useState<Set<number>>(new Set());

	const items = useMemo(() => {
		const all = (query.data?.pages ?? []).flatMap((p) => p.items ?? []);
		// de-dupe by id and drop locally-removed
		const seen = new Set<number>();
		return all.filter((it) => !removed.has(it.id) && (seen.has(it.id) ? false : (seen.add(it.id), true)));
	}, [query.data, removed]);

	const digit = (n: number) => (lang === 'fa' ? toFaDigits(String(n)) : String(n));

	function toggleMode() {
		setSelectMode((v) => !v);
		setSelected(new Set());
	}
	function toggle(id: number) {
		setSelected((s) => {
			const next = new Set(s);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	}
	function selectAll() {
		setSelected(new Set(items.map((i) => i.id)));
	}
	async function confirmDelete() {
		setDeleting(true);
		const ids = [...selected];
		const done: number[] = [];
		for (const id of ids) {
			try {
				await onRemove(id);
				done.push(id);
			} catch {
				/* keep failed items; global toast already reported it */
			}
		}
		setRemoved((r) => new Set([...r, ...done]));
		setSelected(new Set());
		setDeleting(false);
		setConfirmOpen(false);
		if (items.length - done.length <= 0) setSelectMode(false);
	}

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-extrabold text-fg">{heading}</h1>
				<div className="flex items-center gap-2">
					<SegmentedControl
						size="sm"
						value={view}
						onValueChange={(v) => setView(v as 'grid' | 'list')}
						aria-label={t('common.filter')}
						options={[
							{ value: 'grid', label: t('explore.gridView'), icon: LayoutGrid },
							{ value: 'list', label: t('explore.listView'), icon: ListIcon }
						]}
					/>
					{!query.isLoading && !query.isError && items.length > 0 ? (
						<Button
							variant={selectMode ? 'outline' : 'subtle'}
							size="sm"
							leftIcon={selectMode ? X : CheckSquare}
							onClick={toggleMode}
						>
							{selectMode ? t('common.cancel') : t('list.multiDelete')}
						</Button>
					) : null}
				</div>
			</header>

			{selectMode ? (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
					<span className="font-bold text-accent">
						{digit(selected.size)} {t('common.selected')}
					</span>
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" onClick={selectAll}>
							{t('common.selectAll')}
						</Button>
						<Button variant="ghost" size="sm" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>
							{t('common.clear')}
						</Button>
						<Button
							variant="danger"
							size="sm"
							leftIcon={Trash2}
							disabled={selected.size === 0}
							onClick={() => setConfirmOpen(true)}
						>
							{t('common.delete')}
						</Button>
					</div>
				</div>
			) : null}

			{query.isLoading ? (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
					{Array.from({ length: 12 }, (_, i) => (
						<div key={i} className="flex flex-col gap-2">
							<Skeleton rounded="xl" className="aspect-[2/3] w-full" />
							<Skeleton className="h-3 w-3/4" />
							<Skeleton className="h-2.5 w-1/3" />
						</div>
					))}
				</div>
			) : query.isError ? (
				<ErrorState
					title={t('error.generic')}
					message={isApiError(query.error) ? query.error.message : undefined}
					retryLabel={t('common.retry')}
					onRetry={() => void query.refetch()}
				/>
			) : items.length === 0 ? (
				<EmptyState icon={emptyIcon} title={emptyTitle} />
			) : view === 'grid' ? (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
					{items.map((it, i) => (
						<TitleCard
							key={it.id}
							title={it}
							index={i}
							progress={showProgress ? resumeProgress(it.id) : undefined}
							selectMode={selectMode}
							selected={selected.has(it.id)}
							onToggle={toggle}
						/>
					))}
				</div>
			) : (
				<div className="flex flex-col gap-2">
					{items.map((it, i) => (
						<ListRow
							key={it.id}
							title={it}
							index={i}
							progress={showProgress ? resumeProgress(it.id) : undefined}
							selectMode={selectMode}
							selected={selected.has(it.id)}
							onToggle={toggle}
							reduce={!!reduce}
						/>
					))}
				</div>
			)}

			{query.hasNextPage ? (
				<div className="flex justify-center pt-2">
					<Button
						variant="outline"
						loading={query.isFetchingNextPage}
						onClick={() => void query.fetchNextPage()}
					>
						{t('explore.loadMore')}
					</Button>
				</div>
			) : null}

			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>{t('common.confirm')}</DialogTitle>
						<DialogDescription>{t('list.deleteConfirm')}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirmOpen(false)}>
							{t('common.cancel')}
						</Button>
						<Button variant="danger" leftIcon={Trash2} loading={deleting} onClick={confirmDelete}>
							{t('common.delete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ListRow({
	title,
	progress,
	selectMode,
	selected,
	onToggle,
	index,
	reduce
}: {
	title: GenericTitle;
	progress?: number;
	selectMode: boolean;
	selected: boolean;
	onToggle: (id: number) => void;
	index: number;
	reduce: boolean;
}) {
	const { t, lang } = useI18n();
	const assetBase = useSessionStore((s) => s.status?.assetBase ?? '');
	const titleLang = useSettingsStore((s) => s.titleLang);
	const original = title.orgtitles?.[0] ?? title.titles?.[0] ?? title.persian;
	const name = titleLang === 'original' ? original || title.persian : title.persian || original;
	const src = poster(assetBase, title.img, 300);
	const year = title.Year ? (lang === 'fa' ? toFaDigits(String(title.Year)) : String(title.Year)) : '';
	const pct = progress != null ? Math.round(progress * 100) : null;

	const body = (
		<motion.div
			initial={reduce ? false : { opacity: 0, y: 6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.2, delay: reduce ? 0 : Math.min(index, 12) * 0.02 }}
			className={cn(
				'flex items-center gap-3 rounded-xl border p-2.5 transition-colors',
				selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
			)}
		>
			{selectMode ? (
				<div
					className={cn(
						'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
						selected ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong text-transparent'
					)}
				>
					<Check size={13} strokeWidth={3} />
				</div>
			) : null}
			<div
				className="h-16 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2"
				style={{ backgroundColor: placeholderColor(title.id) }}
			>
				{src ? <img src={src} alt={name} loading="lazy" className="h-full w-full object-cover" /> : null}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="truncate font-medium text-fg">{name}</p>
				<div className="flex items-center gap-2 text-xs text-subtle">
					{year ? <span dir={lang === 'fa' ? 'rtl' : 'ltr'}>{year}</span> : null}
					{title.contenttype ? (
						<Badge variant="outline" size="sm" className="normal-case">
							{title.contenttype === 2 ? t('common.series') : t('common.movie')}
						</Badge>
					) : null}
				</div>
				{pct != null ? (
					<div className="flex items-center gap-2">
						<Progress value={pct} size="sm" className="max-w-[200px]" />
						<span className="inline-flex items-center gap-1 text-xs text-accent">
							<Icon icon={Play} size={11} />
							{lang === 'fa' ? toFaDigits(String(pct)) : pct}%
						</span>
					</div>
				) : null}
			</div>
		</motion.div>
	);

	if (selectMode) {
		return (
			<button
				type="button"
				aria-pressed={selected}
				aria-label={name}
				onClick={() => onToggle(title.id)}
				className="cursor-pointer rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
			>
				{body}
			</button>
		);
	}
	return (
		<Link
			to="/title/$id"
			params={{ id: String(title.id) }}
			className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
		>
			{body}
		</Link>
	);
}
