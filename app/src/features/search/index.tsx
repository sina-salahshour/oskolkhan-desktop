/**
 * Search screen: debounced (~300ms) query with Enter-to-search, an all/movie/series
 * type SegmentedControl, and three result groups — Titles (grid), People (avatars),
 * Keywords (chips). useSearch({ phrase, type, ignoreTypes:0, page:0 }); EmptyState for
 * idle / no-results, ErrorState (normalized message, never [object Object]) on error.
 * Default export is the screen the router wires in place of SearchStub.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch as useRouteSearch } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Search as SearchIcon, Users, Tag } from '@lucide/react';
import type { tti } from '@/lib/api';
import { isApiError } from '@/lib/api';
import { useSearch, useCoreStatus } from '@/lib/query';
import { person, placeholderColor } from '@/lib/util/images';
import { Input, SegmentedControl, Chip, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAssetBase, loc } from './util';
import { TitleCard } from './components/TitleCard';

function PersonCard({ p, index }: { p: tti; index: number }) {
	const assetBase = useAssetBase();
	const reduce = useReducedMotion();
	const [failed, setFailed] = useState(false);
	const src = person(assetBase, p.img);
	return (
		<motion.div
			className="group flex flex-col items-center gap-1 text-center"
			initial={reduce ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : Math.min(index, 12) * 0.03 }}
		>
			<div
				className="mb-1 grid h-20 w-20 place-items-center overflow-hidden rounded-full border-2 border-line text-2xl font-bold text-accent transition-transform duration-200 group-hover:scale-105"
				style={{ background: placeholderColor(p.id) }}
			>
				{src && !failed ? (
					<img
						src={src}
						alt={p.title1}
						loading="lazy"
						onError={() => setFailed(true)}
						className="h-full w-full object-cover"
					/>
				) : (
					<span>{p.title1.slice(0, 1)}</span>
				)}
			</div>
			<p className="text-sm font-semibold text-fg">{p.title1}</p>
			{p.title2 ? <p className="text-xs text-muted">{p.title2}</p> : null}
		</motion.div>
	);
}

export default function SearchScreen() {
	const { t, lang } = useI18n();
	const ready = useCoreStatus().data?.phase === 'ready';

	const sp = useRouteSearch({ strict: false }) as { q?: string; t?: string };
	const navigate = useNavigate();

	const [query, setQuery] = useState(sp.q ?? '');
	const [phrase, setPhrase] = useState(sp.q ?? '');
	const [type, setType] = useState(sp.t ?? '0');
	const inputRef = useRef<HTMLInputElement>(null);

	// Mirror the committed search into the URL so navigating away and back restores
	// it (results then come straight from the Query cache instead of an empty state).
	// Guarded: only navigate when the URL is actually out of sync, so the mount-time
	// default state never rewrites history and a Home/Back click is never fought.
	useEffect(() => {
		const nextQ = phrase || undefined;
		const nextT = type !== '0' ? type : undefined;
		if (sp.q === nextQ && sp.t === nextT) return;
		navigate({ to: '/search', search: { q: nextQ, t: nextT }, replace: true });
	}, [phrase, type, navigate, sp.q, sp.t]);

	// debounce the input into `phrase`
	useEffect(() => {
		const q = query.trim();
		const id = setTimeout(() => setPhrase(q), 300);
		return () => clearTimeout(id);
	}, [query]);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const { data, isFetching, isError, error, refetch } = useSearch(
		{ phrase, type: Number(type), ignoreTypes: 0, page: 0 },
		{ enabled: ready && phrase.length > 0 }
	);

	const hasResults =
		!!data && (data.Titles.length > 0 || data.People.length > 0 || data.Keywords.length > 0);
	const errorMessage = isApiError(error)
		? error.message
		: error instanceof Error
			? error.message
			: error
				? String(error)
				: undefined;

	const pickKeyword = (word: string) => {
		setQuery(word);
		setPhrase(word.trim());
	};

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-6">
			<div className="mb-6 flex flex-wrap items-center gap-4">
				<div className="min-w-[260px] flex-1">
					<Input
						ref={inputRef}
						type="search"
						leftIcon={SearchIcon}
						placeholder={t('search.placeholder')}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') setPhrase(query.trim());
						}}
						aria-label={t('common.search')}
					/>
				</div>
				<SegmentedControl
					value={type}
					onValueChange={setType}
					options={[
						{ value: '0', label: t('common.all') },
						{ value: '1', label: t('common.movie') },
						{ value: '2', label: t('common.series') }
					]}
					aria-label={t('common.filter')}
				/>
			</div>

			{!phrase ? (
				<EmptyState icon={SearchIcon} title={t('search.empty')} />
			) : isFetching && !data ? (
				<div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
					{Array.from({ length: 10 }, (_, i) => (
						<div key={i} className="flex flex-col gap-2">
							<Skeleton rounded="lg" className="aspect-[2/3] w-full" />
							<Skeleton className="h-3 w-3/4" />
						</div>
					))}
				</div>
			) : isError ? (
				<ErrorState
					title={t('error.generic')}
					message={errorMessage}
					retryLabel={t('common.retry')}
					onRetry={() => void refetch()}
				/>
			) : data && !hasResults ? (
				<EmptyState icon={SearchIcon} title={t('search.noResults', { q: phrase })} />
			) : data ? (
				<div className={`flex flex-col gap-8 transition-opacity ${isFetching ? 'opacity-55' : ''}`}>
					{data.Titles.length ? (
						<section>
							<h2 className="mb-4 text-lg font-semibold text-fg">{t('search.titles')}</h2>
							<div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
								{data.Titles.map((title, i) => (
									<TitleCard key={`${title.id}-${i}`} title={title} index={i} />
								))}
							</div>
						</section>
					) : null}

					{data.People.length ? (
						<section>
							<h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-fg">
								<Users size={18} /> {t('search.people')}
							</h2>
							<div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(110px,1fr))]">
								{data.People.map((p, i) => (
									<PersonCard key={`${p.id}-${i}`} p={p} index={i} />
								))}
							</div>
						</section>
					) : null}

					{data.Keywords.length ? (
						<section>
							<h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-fg">
								<Tag size={18} /> {t('search.keywords')}
							</h2>
							<div className="flex flex-wrap gap-2">
								{data.Keywords.map((k) => (
									<Chip key={k.id} onClick={() => pickKeyword(k.title1)}>
										{k.title1}
										{k.title2 ? (
											<span className="ms-1 text-subtle">{loc(lang, k.title2)}</span>
										) : null}
									</Chip>
								))}
							</div>
						</section>
					) : null}
				</div>
			) : null}
		</div>
	);
}
