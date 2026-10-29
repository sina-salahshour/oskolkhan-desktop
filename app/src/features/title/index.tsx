import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Button, ErrorState, RatingChip, Skeleton, SkeletonText } from '../../components/ui';
import { useFiles, useItem, useItemDetail, useLike, usePreload } from '../../lib/query';
import { useSessionStore } from '../../lib/stores/session';
import { usePlayerStore } from '../../lib/stores/player';
import { useDownloadsStore } from '../../lib/stores/downloads';
import { useToastStore } from '../../lib/stores/toast';
import { useI18n } from '../../i18n';
import type { FileV2, GroupInfoV2 } from '../../lib/api/types';
import { TitleHeader } from './components/TitleHeader';
import { FileTree } from './components/FileTree';
import { PersonCard } from './components/PersonCard';
import { RecommendedRow } from './components/RecommendedRow';
import { ExtraDetail } from './components/ExtraDetail';
import { useCopyLink } from './hooks/useCopyLink';
import { ratingMeta } from './lib/badges';

function firstPlayable(node: GroupInfoV2 | null | undefined): { file: FileV2 } | null {
	if (!node) return null;
	if (node.Files.length) return { file: node.Files[0] };
	for (const c of node.Child) {
		const r = firstPlayable(c);
		if (r) return r;
	}
	return null;
}

function SectionTitle({ children }: { children: string }) {
	return <h2 className="mb-3 text-lg font-semibold text-fg">{children}</h2>;
}

export default function TitleScreen() {
	const { id } = useParams({ from: '/title/$id' });
	const tid = Number(id);
	const { t, lang } = useI18n();
	const reduce = useReducedMotion();
	const navigate = useNavigate();
	const assetBase = useSessionStore((s) => s.status?.assetBase ?? '');
	const item = useItem(tid);
	const detailQ = useItemDetail(tid);
	const filesQ = useFiles(tid);
	const pre = usePreload();
	const like = useLike();
	const copyLink = useCopyLink();
	const push = useToastStore((s) => s.push);
	const [liked, setLiked] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const title = item.data;
	const detail = detailQ.data;
	const files = filesQ.data;

	const cast = useMemo(
		() => (detail ? [...detail.director, ...detail.creator, ...detail.people].slice(0, 12) : []),
		[detail]
	);

	if (item.isError) {
		return (
			<div className="p-6">
				<ErrorState
					onRetry={() => void item.refetch()}
					retryLabel={t('common.retry')}
				/>
			</div>
		);
	}
	if (item.isLoading || !title) {
		return (
			<div className="flex flex-col gap-6 p-4 sm:p-6">
				<Skeleton rounded="xl" className="h-[420px] w-full" />
				<div className="grid gap-6 lg:grid-cols-[1fr_320px]">
					<SkeletonText lines={5} />
					<Skeleton rounded="lg" className="h-48 w-full" />
				</div>
			</div>
		);
	}

	const playFile = (file: FileV2) => {
		// External links (YouTube/Aparat trailers) carry a full URL as their urn.
		// Open them in the real browser instead of the in-app /stream player.
		if (/^https?:\/\//i.test(file.urn)) {
			void window.oskol?.openExternal(file.urn);
			return;
		}
		usePlayerStore.getState().setSource({
			title,
			file,
			urn: file.urn,
			filename: file.Title[0] ?? file.description ?? ''
		});
		void navigate({ to: '/player' });
	};

	const playDefault = () => {
		const p = firstPlayable(files?.Items);
		if (p) playFile(p.file);
		else {
			usePlayerStore.getState().setSource({ title });
			void navigate({ to: '/player' });
		}
	};

	const download = (file: FileV2) => {
		useDownloadsStore.getState().add({
			titleId: tid,
			title: title.persian,
			urn: file.urn,
			group: file.Title[0],
			sizeBytes: file.Size * 1024 * 1024
		});
	};

	const likeFile = () => {
		like.mutate(
			{ category: title.contenttype, item: tid, on: true, status: 1 },
			{ onSuccess: () => push({ tone: 'success', title: t('common.liked') }) }
		);
	};

	const toggleLike = () => {
		const next = !liked;
		setLiked(next);
		like.mutate(
			{ category: title.contenttype, item: tid, on: next, status: 1 },
			{
				onSuccess: () => {
					if (next) push({ tone: 'success', title: t('common.liked') });
				},
				onError: () => setLiked(!next)
			}
		);
	};

	const desc = title.Description ?? '';
	const long = desc.length > 180;
	const ratings = (detail?.rating ?? []).filter((r) => r.r1);

	return (
		<motion.article
			className="flex flex-col gap-6 p-4 sm:p-6"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: reduce ? 0.01 : 0.2 }}
		>
			<div>
				<Link to="/" className="text-sm text-muted hover:text-fg">
					{t('common.back')}
				</Link>
			</div>
			<TitleHeader
				title={title}
				detail={detail}
				pre={pre.data}
				assetBase={assetBase}
				liked={liked}
				onPlay={playDefault}
				onDownload={playDefault}
				onToggleLike={toggleLike}
				onShare={() => void window.oskol?.clipboardWrite(`oskolkhan://title/${tid}`)}
				onOpenExternal={playDefault}
			/>
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="flex min-w-0 flex-col gap-8">
					{ratings.length > 0 ? (
						<section>
							<SectionTitle>{t('title.ratings')}</SectionTitle>
							<div className="flex flex-wrap gap-2">
								{ratings.map((r, i) => {
									const meta = ratingMeta(r.type);
									const chip = <RatingChip source={meta.label || '—'} score={r.r1} tone={r.type === 1 ? 'gold' : 'default'} />;
									return r.uri ? (
										<button
											key={`${r.type}-${i}`}
											type="button"
											onClick={() => void window.oskol?.openExternal(r.uri)}
											className="rounded-full transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
										>
											{chip}
										</button>
									) : (
										<span key={`${r.type}-${i}`}>{chip}</span>
									);
								})}
							</div>
						</section>
					) : null}
					{desc ? (
						<section>
							<SectionTitle>{t('title.synopsis')}</SectionTitle>
							<p className={`whitespace-pre-line text-sm leading-7 text-muted ${expanded || !long ? '' : 'line-clamp-3'}`}>
								{desc}
							</p>
							{long ? (
								<Button variant="ghost" size="sm" className="mt-1" onClick={() => setExpanded((e) => !e)}>
									{expanded ? t('title.readLess') : t('title.readMore')}
								</Button>
							) : null}
						</section>
					) : null}
					<section>
						<SectionTitle>{t('title.files')}</SectionTitle>
						{filesQ.isLoading ? (
							<Skeleton rounded="lg" className="h-24 w-full" />
						) : filesQ.isError ? (
							<ErrorState onRetry={() => void filesQ.refetch()} retryLabel={t('common.retry')} />
						) : files?.Items ? (
							<FileTree
								node={files.Items}
								onPlay={playFile}
								onDownload={download}
								onCopyLink={copyLink}
								onLike={likeFile}
								assetBase={assetBase}
							/>
						) : null}
					</section>
					{cast.length > 0 ? (
						<section>
							<SectionTitle>{t('title.cast')}</SectionTitle>
							<ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(96px,1fr))]">
								{cast.map((p, i) => (
									<PersonCard key={`${p.id}-${i}`} p={p} assetBase={assetBase} index={i} />
								))}
							</ul>
						</section>
					) : null}
				</div>
				<aside className="flex min-w-0 flex-col gap-8">
					{detail ? <ExtraDetail detail={detail} pre={pre.data} /> : <Skeleton rounded="lg" className="h-40 w-full" />}
					{detail && detail.recommended.length > 0 ? (
						<section>
							<SectionTitle>{t('title.recommendations')}</SectionTitle>
							<RecommendedRow items={detail.recommended} assetBase={assetBase} />
						</section>
					) : null}
				</aside>
			</div>
		</motion.article>
	);
}
