import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, Copy, Download, Heart, Play } from '@lucide/react';
import { Badge, IconButton } from '../../../components/ui';
import { usePreload } from '../../../lib/query';
import { useI18n } from '../../../i18n';
import { cn } from '../../../lib/util/cn';
import type { FileV2, GroupInfoV2 } from '../../../lib/api/types';
import { groupBadges } from '../lib/badges';
import { digits, fileSizeMb, videoFormat } from '../lib/format';

export interface FileTreeProps {
	node: GroupInfoV2;
	level?: number;
	onPlay: (file: FileV2, playlist: FileV2[], index: number) => void;
	onDownload: (file: FileV2) => void;
	onCopyLink: (file: FileV2) => void;
	onLike: (file: FileV2) => void;
	assetBase: string;
}

function FileRow({
	file,
	index,
	node,
	onPlay,
	onDownload,
	onCopyLink,
	onLike
}: { file: FileV2; index: number; node: GroupInfoV2 } & Pick<
	FileTreeProps,
	'onPlay' | 'onDownload' | 'onCopyLink' | 'onLike'
>) {
	const { t, lang } = useI18n();
	const name = file.Title[0] ?? (file.description || t('common.episode'));
	const extra = file.ExtraInfo.filter(Boolean).join(' · ');
	const isLink = /^https?:\/\//i.test(file.urn);
	const fmt = videoFormat(file.urn);
	const isYoutube = isLink && /youtu\.?be/i.test(file.urn);
	return (
		<li className="group flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-2">
			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<span className="truncate text-sm text-fg">{name}</span>
					{fmt ? (
						<Badge variant="accent" size="sm">
							{fmt}
						</Badge>
					) : null}
					{isYoutube ? (
						<Badge variant="danger" size="sm">
							YouTube
						</Badge>
					) : isLink ? (
						<Badge variant="neutral" size="sm">
							{t('item.external')}
						</Badge>
					) : null}
					{file.isDub ? (
						<Badge variant="danger" size="sm">
							دوبله
						</Badge>
					) : null}
					{file.SoftSub ? (
						<Badge variant="neutral" size="sm">
							Sub
						</Badge>
					) : null}
				</div>
				{extra || file.Size > 0 ? (
					<div className="mt-0.5 truncate text-xs text-muted">
						{[extra, file.Size > 0 ? fileSizeMb(file.Size, lang) : ''].filter(Boolean).join(' · ')}
					</div>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-0.5">
				<IconButton icon={Play} label={t('common.play')} size="sm" onClick={() => onPlay(file, node.Files, index)} />
				<IconButton icon={Copy} label={t('item.copyLink')} size="sm" onClick={() => onCopyLink(file)} />
				<IconButton icon={Heart} label={t('common.like')} size="sm" onClick={() => onLike(file)} />
				{file.Download ? (
					<IconButton icon={Download} label={t('common.download')} size="sm" onClick={() => onDownload(file)} />
				) : null}
			</div>
		</li>
	);
}

export function FileTree(props: FileTreeProps) {
	const { node, level = 0, assetBase } = props;
	const { lang } = useI18n();
	const reduce = useReducedMotion();
	const pre = usePreload();
	const [open, setOpen] = useState(level < 1);
	const badges = groupBadges(node);
	const color = pre.data?.listingcolors?.[node.Color];
	const dotColor = color && /^(#|rgb|hsl)/i.test(color) ? color : undefined;
	const hasTitle = node.Title.length > 0 && Boolean(node.Title[0]);

	const body = (
		<div className={cn(hasTitle && 'ms-3 border-s border-line ps-2')}>
			{node.Child.map((c, i) => (
				<FileTree key={`${c.id}-${i}`} {...props} node={c} level={level + 1} />
			))}
			{node.Files.length > 0 ? (
				<ul className="py-1">
					{node.Files.map((f, i) => (
						<FileRow
							key={`${f.id}-${i}`}
							file={f}
							index={i}
							node={node}
							onPlay={props.onPlay}
							onDownload={props.onDownload}
							onCopyLink={props.onCopyLink}
							onLike={props.onLike}
						/>
					))}
				</ul>
			) : null}
		</div>
	);

	if (!hasTitle) return body;

	return (
		<div className={cn(level === 0 && 'overflow-hidden rounded-lg border border-line bg-surface', level > 0 && 'mt-1')}>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				<span
					className={cn('h-2.5 w-2.5 shrink-0 rounded-full', !dotColor && 'bg-line-strong')}
					style={dotColor ? { background: dotColor } : undefined}
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold text-fg">{node.Title[0]}</span>
					{node.Title[1] ? <span className="block truncate text-xs text-muted">{node.Title[1]}</span> : null}
				</span>
				<span className="hidden shrink-0 items-center gap-1 sm:flex">
					{badges.map((b) => (
						<Badge key={b.label} variant={b.variant} size="sm">
							{b.label}
						</Badge>
					))}
				</span>
				{node.FilesCount > 0 ? (
					<span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
						{digits(node.FilesCount, lang)}
					</span>
				) : null}
				<motion.span
					className="shrink-0 text-muted"
					animate={{ rotate: open ? 180 : 0 }}
					transition={{ duration: reduce ? 0 : 0.2 }}
				>
					<ChevronDown size={16} />
				</motion.span>
			</button>
			<AnimatePresence initial={false}>
				{open ? (
					<motion.div
						key="body"
						initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
						animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
						exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
						transition={{ duration: reduce ? 0.01 : 0.22, ease: 'easeOut' }}
						className="overflow-hidden"
					>
						<div className="border-t border-line px-1 pb-1">{body}</div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}
