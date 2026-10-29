/**
 * Ctrl/⌘+K command palette. Jumps to pages and (when you type) searches titles
 * via the search RPC (debounced). Keyboard: ↑/↓ to move, Enter to go, Esc closes.
 * Open state lives in the UI store so any component can open it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Search, CornerDownLeft } from '@lucide/react';
import { Dialog, DialogContent, Icon } from '../components/ui';
import { useUiStore } from '../lib/stores/ui';
import { useT } from '../i18n';
import { useSearch } from '../lib/query';
import { allNavItems } from './nav';

interface Choice {
	key: string;
	label: string;
	to: string;
	kind: 'page' | 'title';
}

export function CommandPalette() {
	const t = useT();
	const navigate = useNavigate();
	const reduce = useReducedMotion();
	const open = useUiStore((s) => s.commandOpen);
	const setOpen = useUiStore((s) => s.setCommandOpen);

	const [query, setQuery] = useState('');
	const [debounced, setDebounced] = useState('');
	const [active, setActive] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	// global hotkey
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setOpen(!useUiStore.getState().commandOpen);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [setOpen]);

	// reset on open/close
	useEffect(() => {
		if (!open) {
			setQuery('');
			setDebounced('');
			setActive(0);
		}
	}, [open]);

	// debounce the title search query
	useEffect(() => {
		const id = setTimeout(() => setDebounced(query.trim()), 220);
		return () => clearTimeout(id);
	}, [query]);

	const { data: search } = useSearch(
		{ phrase: debounced, type: 0, ignoreTypes: 0, page: 0 },
		{ enabled: open && debounced.length > 1 }
	);

	const pages: Choice[] = useMemo(() => {
		const q = query.trim().toLowerCase();
		return allNavItems
			.map((n) => ({ key: `page:${n.to}`, label: t(n.labelKey), to: n.to, kind: 'page' as const }))
			.filter((c) => !q || c.label.toLowerCase().includes(q));
	}, [query, t]);

	const titles: Choice[] = useMemo(() => {
		const list = search?.Titles ?? [];
		return list.slice(0, 8).map((g) => ({
			key: `title:${g.id}`,
			label: g.persian || g.titles?.[0] || `#${g.id}`,
			to: `/title/${g.id}`,
			kind: 'title' as const
		}));
	}, [search]);

	const choices = useMemo(() => [...pages, ...titles], [pages, titles]);

	useEffect(() => {
		if (active >= choices.length) setActive(0);
	}, [choices.length, active]);

	const go = (c: Choice | undefined) => {
		if (!c) return;
		setOpen(false);
		void navigate({ to: c.to });
	};

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			setActive((i) => Math.min(i + 1, choices.length - 1));
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			setActive((i) => Math.max(i - 1, 0));
		} else if (e.key === 'Enter') {
			e.preventDefault();
			go(choices[active]);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent size="lg" hideClose className="p-0">
				<div className="flex items-center gap-3 border-b border-line px-4">
					<Icon icon={Search} size={18} className="text-subtle" />
					<input
						autoFocus
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={onKeyDown}
						placeholder={t('cmd.placeholder')}
						className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
						aria-label={t('cmd.placeholder')}
					/>
				</div>

				<div ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
					{choices.length === 0 && (
						<p className="px-3 py-8 text-center text-sm text-subtle">
							{query ? t('cmd.noResults') : t('cmd.hint')}
						</p>
					)}

					{pages.length > 0 && (
						<Section label={t('cmd.pages')} />
					)}
					{pages.map((c) => (
						<Row
							key={c.key}
							choice={c}
							active={choices[active]?.key === c.key}
							reduce={!!reduce}
							onSelect={go}
							onHover={() => setActive(choices.indexOf(c))}
						/>
					))}

					{titles.length > 0 && <Section label={t('cmd.titles')} />}
					{titles.map((c) => (
						<Row
							key={c.key}
							choice={c}
							active={choices[active]?.key === c.key}
							reduce={!!reduce}
							onSelect={go}
							onHover={() => setActive(choices.indexOf(c))}
						/>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function Section({ label }: { label: string }) {
	return (
		<div className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
			{label}
		</div>
	);
}

function Row({
	choice,
	active,
	reduce,
	onSelect,
	onHover
}: {
	choice: Choice;
	active: boolean;
	reduce: boolean;
	onSelect: (c: Choice) => void;
	onHover: () => void;
}) {
	return (
		<motion.button
			type="button"
			role="option"
			aria-selected={active}
			onMouseMove={onHover}
			onClick={() => onSelect(choice)}
			whileTap={reduce ? undefined : { scale: 0.99 }}
			className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-start text-sm outline-none transition-colors ${
				active ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-surface-2'
			}`}
		>
			<span className="truncate">{choice.label}</span>
			{active && <Icon icon={CornerDownLeft} size={14} className="text-subtle" />}
		</motion.button>
	);
}
