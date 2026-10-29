/**
 * Explore / advanced-filter screen. The FilterPanel builds a Partial<AdvanceFiler>;
 * results come from useGetMore({ endpoint, filter }) (infinite). The endpoint is
 * `filter` by default, or `?more=<endpoint>` when arriving from a home "see all".
 * Grid/list toggle, relaxation hints, and paginated load-more. Default export is
 * the screen the router wires in place of ExploreStub.
 */
import { useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { Compass, SlidersHorizontal, Info, LayoutGrid, List, ChevronDown } from '@lucide/react';
import type { AdvanceFiler } from '@/lib/api';
import { isApiError } from '@/lib/api';
import { useGetMore, useCoreStatus } from '@/lib/query';
import {
	Button,
	Badge,
	Icon,
	SegmentedControl,
	Skeleton,
	Spinner,
	EmptyState,
	ErrorState
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { loc } from './util';
import { FilterPanel } from './components/FilterPanel';
import { TitleCard } from './components/TitleCard';
import { ResultRow } from './components/ResultRow';

function GridSkeleton() {
	return (
		<div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
			{Array.from({ length: 12 }, (_, i) => (
				<div key={i} className="flex flex-col gap-2">
					<Skeleton rounded="lg" className="aspect-[2/3] w-full" />
					<Skeleton className="h-3 w-4/5" />
					<Skeleton className="h-3 w-1/2" />
				</div>
			))}
		</div>
	);
}

export default function ExploreScreen() {
	const { t, lang } = useI18n();
	const search = useSearch({ strict: false }) as { more?: string };
	const endpoint = search.more || 'filter';

	const ready = useCoreStatus().data?.phase === 'ready';
	const [filter, setFilter] = useState<Partial<AdvanceFiler>>({});
	const [view, setView] = useState<'grid' | 'list'>('grid');
	const [panelOpen, setPanelOpen] = useState(false);

	const query = useGetMore({ endpoint, filter }, { enabled: ready });
	const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
		query;

	const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
	const latest = data?.pages[data.pages.length - 1];
	const total = data?.pages[0]?.total ?? 0;
	const relaxed = latest?.relaxed ?? [];
	const relaxations = latest?.relaxations ?? [];
	const hasRelaxation = relaxed.length > 0 || relaxations.length > 0;

	const facetLabel = (facet: string) => {
		const key = `explore.${facet.split('.').pop() ?? facet}`;
		const label = t(key);
		return label === key ? facet : label;
	};

	const loading = !ready || isLoading;

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-6">
			<div className="mb-5 flex items-center justify-between gap-4">
				<h1 className="inline-flex items-center gap-2 text-2xl font-bold text-fg">
					<Icon icon={Compass} size={22} />
					<span>{t('explore.title')}</span>
				</h1>
				<Button
					variant="outline"
					size="sm"
					leftIcon={SlidersHorizontal}
					className="lg:hidden"
					onClick={() => setPanelOpen((v) => !v)}
				>
					{t('common.filter')}
				</Button>
			</div>

			<div className="grid items-start gap-5 lg:grid-cols-[300px_1fr]">
				<aside className={`${panelOpen ? 'block' : 'hidden'} lg:sticky lg:top-5 lg:block`}>
					<FilterPanel onChange={setFilter} />
				</aside>

				<section className="flex min-w-0 flex-col gap-4">
					<header className="flex items-center justify-between gap-4">
						<div className="inline-flex items-baseline gap-2">
							<span className="text-xl font-extrabold text-accent tabular-nums">{loc(lang, total)}</span>
							<span className="text-sm text-muted">{t('explore.results')}</span>
						</div>
						<SegmentedControl
							size="sm"
							value={view}
							onValueChange={(v) => setView(v as 'grid' | 'list')}
							options={[
								{ value: 'grid', label: t('explore.gridView'), icon: LayoutGrid },
								{ value: 'list', label: t('explore.listView'), icon: List }
							]}
							aria-label={t('common.filter')}
						/>
					</header>

					{hasRelaxation ? (
						<div
							role="status"
							className="flex flex-col gap-3 rounded-lg border border-accent bg-accent-soft px-4 py-3"
						>
							<div className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
								<Icon icon={Info} size={16} />
								<span>{t('explore.relaxedNotice')}</span>
							</div>
							{relaxations.length ? (
								<div className="flex flex-wrap gap-3">
									{relaxations.map((r) => (
										<span key={r.facet} className="inline-flex items-center gap-2">
											<Badge variant="accent">{facetLabel(r.facet)}</Badge>
											<span className="text-xs text-muted">
												{t('explore.relaxHint', { n: loc(lang, r.wouldBe) })}
											</span>
										</span>
									))}
								</div>
							) : null}
						</div>
					) : null}

					{loading ? (
						<GridSkeleton />
					) : isError ? (
						<ErrorState
							title={t('error.generic')}
							message={isApiError(error) ? error.message : String(error)}
							retryLabel={t('common.retry')}
							onRetry={() => void refetch()}
						/>
					) : items.length === 0 ? (
						<EmptyState icon={Compass} title={t('explore.noResults')} />
					) : (
						<>
							{view === 'grid' ? (
								<div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
									{items.map((item, i) => (
										<TitleCard key={`${item.id}-${i}`} title={item} index={i} />
									))}
								</div>
							) : (
								<div className="flex flex-col gap-3">
									{items.map((item, i) => (
										<ResultRow key={`${item.id}-${i}`} title={item} index={i} />
									))}
								</div>
							)}

							{hasNextPage ? (
								<div className="flex justify-center py-4">
									<Button
										variant="outline"
										size="lg"
										leftIcon={ChevronDown}
										loading={isFetchingNextPage}
										onClick={() => void fetchNextPage()}
									>
										{t('explore.loadMore')}
									</Button>
								</div>
							) : null}

							{isFetchingNextPage ? (
								<div className="flex justify-center py-3">
									<Spinner size={22} label={t('common.loading')} />
								</div>
							) : null}
						</>
					)}
				</section>
			</div>
		</div>
	);
}
