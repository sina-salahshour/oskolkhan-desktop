/**
 * Persistent app chrome: a collapsible sidebar, a topbar with working
 * Back/Forward (wired to BOTH router history and the native menu via
 * window.oskol.onNav), a command-palette trigger, theme + language toggles, and
 * an animated <Outlet/> for routed pages. Renders the boot overlay + palette.
 */
import { useEffect } from 'react';
import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
	ArrowRight,
	ArrowLeft,
	Search,
	Command,
	SunMedium,
	MoonStar,
	Languages,
	PanelLeftClose,
	PanelLeftOpen
} from '@lucide/react';
import { IconButton, Icon, TooltipTip } from '../components/ui';
import { useUiStore, resolveTheme } from '../lib/stores/ui';
import { useI18n } from '../i18n';
import { navItems, navFooterItems, allNavItems, type NavItem } from './nav';
import { ErrorBoundary } from './ErrorBoundary';
import { BootOverlay } from './BootOverlay';
import { CommandPalette } from './CommandPalette';

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
	const { t } = useI18n();
	const label = t(item.labelKey);
	const link = (
		<Link
			to={item.to}
			activeOptions={{ exact: item.to === '/' }}
			className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
			activeProps={{
				className:
					'flex items-center gap-3 rounded-lg px-3 py-2 text-sm bg-accent-soft text-accent font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent'
			}}
			aria-label={collapsed ? label : undefined}
		>
			<Icon icon={item.icon} size={20} />
			{!collapsed && <span className="truncate">{label}</span>}
		</Link>
	);
	return collapsed ? (
		<TooltipTip label={label} side="right">
			{link}
		</TooltipTip>
	) : (
		link
	);
}

export function AppShell() {
	const router = useRouter();
	const reduce = useReducedMotion();
	const { t } = useI18n();

	const collapsed = useUiStore((s) => s.sidebarCollapsed);
	const setCollapsed = useUiStore((s) => s.setSidebarCollapsed);
	const theme = useUiStore((s) => s.theme);
	const toggleTheme = useUiStore((s) => s.toggleTheme);
	const { lang, toggleLang } = useI18n();

	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const resolved = resolveTheme(theme);

	// Native menu Back/Forward -> router history.
	useEffect(() => {
		const off = window.oskol?.onNav((dir) => {
			if (dir === 'back') router.history.back();
			else router.history.forward();
		});
		return () => off?.();
	}, [router]);

	const current = allNavItems.find((n) =>
		n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)
	);
	const crumb = current ? t(current.labelKey) : t('app.name');

	return (
		<div className="flex h-screen w-full overflow-hidden bg-bg text-fg">
			{/* Sidebar */}
			<aside
				className={`flex shrink-0 flex-col border-e border-line bg-surface transition-[width] duration-200 ${
					collapsed ? 'w-16' : 'w-60'
				}`}
			>
				<div className="flex h-14 items-center gap-2.5 px-4">
					{/* Branded play mark (matches the app icon): amber triangle in a ring. */}
					<div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 ring-1 ring-line">
						<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
							<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-accent opacity-40" />
							<path d="M10 8.2 L10 15.8 L16 12 Z" className="fill-accent" />
						</svg>
					</div>
					{!collapsed && (
						<span className="truncate text-[15px] font-bold tracking-tight">{t('app.name')}</span>
					)}
				</div>

				<nav className="flex flex-1 flex-col gap-1 px-2 py-2">
					{navItems.map((item) => (
						<SideLink key={item.to} item={item} collapsed={collapsed} />
					))}
					<div className="my-2 h-px bg-line" />
					{navFooterItems.map((item) => (
						<SideLink key={item.to} item={item} collapsed={collapsed} />
					))}
				</nav>

				<div className="p-2">
					<IconButton
						icon={collapsed ? PanelLeftOpen : PanelLeftClose}
						label={collapsed ? 'Expand' : 'Collapse'}
						variant="ghost"
						onClick={() => setCollapsed(!collapsed)}
					/>
				</div>
			</aside>

			{/* Main column */}
			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-4 backdrop-blur">
					<div className="flex items-center gap-1">
						<TooltipTip label={t('common.back')} side="bottom">
							<IconButton
								icon={lang === 'fa' ? ArrowRight : ArrowLeft}
								label={t('common.back')}
								onClick={() => router.history.back()}
							/>
						</TooltipTip>
						<TooltipTip label={t('common.next')} side="bottom">
							<IconButton
								icon={lang === 'fa' ? ArrowLeft : ArrowRight}
								label={t('common.next')}
								onClick={() => router.history.forward()}
							/>
						</TooltipTip>
					</div>

					<div className="ms-2 truncate text-sm font-medium text-muted">{crumb}</div>

					<div className="flex-1" />

					<button
						type="button"
						onClick={() => useUiStore.getState().setCommandOpen(true)}
						className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-subtle outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
					>
						<Icon icon={Search} size={14} />
						<span className="hidden sm:inline">{t('cmd.placeholder')}</span>
						<kbd className="ms-2 hidden items-center gap-0.5 rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted sm:inline-flex">
							<Icon icon={Command} size={10} /> K
						</kbd>
					</button>

					<TooltipTip label={t('settings.language')} side="bottom">
						<IconButton icon={Languages} label={t('settings.language')} onClick={toggleLang} />
					</TooltipTip>
					<TooltipTip label={t('settings.theme')} side="bottom">
						<IconButton
							icon={resolved === 'dark' ? SunMedium : MoonStar}
							label={t('settings.theme')}
							onClick={toggleTheme}
						/>
					</TooltipTip>
				</header>

				<main className="relative flex-1 overflow-y-auto">
					<ErrorBoundary>
						{/* Enter-only, keyed by route: each navigation remounts and plays the
						    enter animation. No AnimatePresence `mode="wait"` — that waits for the
						    outgoing page's exit before mounting the next one, which intermittently
						    left pages blank (settings/search on return). */}
						<motion.div
							key={pathname}
							initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
							animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
							transition={{ duration: reduce ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
							className="min-h-full"
						>
							<Outlet />
						</motion.div>
					</ErrorBoundary>
				</main>
			</div>

			<BootOverlay />
			<CommandPalette />
		</div>
	);
}
