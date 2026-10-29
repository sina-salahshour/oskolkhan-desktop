/**
 * Code-based TanStack Router tree. The root route renders the AppShell (sidebar +
 * topbar + palette + boot overlay) with an <Outlet/>; every screen is a child
 * route wired to a Phase-1 placeholder. PHASE 2: replace a route's `component`
 * with the real feature screen, e.g.
 *     import { HomeScreen } from '../features/home';
 *     homeRoute.update({ component: HomeScreen })   // or edit the route below.
 * Keep the paths/ids below stable — they are the navigation contract.
 */
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from './AppShell';
import { ErrorState } from '../components/ui';
import HomeScreen from '../features/home';
import ExploreScreen from '../features/explore';
import SearchScreen from '../features/search';
import TitleScreen from '../features/title';
import PlayerScreen from '../features/player';
import DownloadsScreen from '../features/downloads';
import LikesScreen from '../features/library/likes';
import HistoryScreen from '../features/library/history';
import SettingsScreen from '../features/settings';
import AccountScreen from '../features/account';
import AuthScreen from '../features/auth';

export const rootRoute = createRootRoute({
	component: AppShell,
	errorComponent: ({ error }) => (
		<div className="flex min-h-[70vh] items-center justify-center p-6">
			<ErrorState message={error instanceof Error ? error.message : String(error)} />
		</div>
	),
	notFoundComponent: () => (
		<div className="flex min-h-[70vh] items-center justify-center p-6">
			<ErrorState title="404" message="Not found" />
		</div>
	)
});

// Route ids are the file-less paths; keep them stable for Phase-2 workers.
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomeScreen });
export const exploreRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/explore',
	component: ExploreScreen,
	validateSearch: (s: Record<string, unknown>): { more?: string } => ({
		more: typeof s.more === 'string' ? s.more : undefined
	})
});
export const searchRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/search',
	component: SearchScreen,
	validateSearch: (s: Record<string, unknown>): { q?: string; t?: string } => ({
		q: typeof s.q === 'string' && s.q ? s.q : undefined,
		t: s.t === '1' || s.t === '2' ? s.t : undefined
	})
});
export const titleRoute = createRoute({ getParentRoute: () => rootRoute, path: '/title/$id', component: TitleScreen });
export const playerRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/player',
	component: PlayerScreen,
	validateSearch: (s: Record<string, unknown>): { id?: number } => {
		const n = s.id != null ? Number(s.id) : NaN;
		return { id: Number.isFinite(n) ? n : undefined };
	}
});
export const downloadsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/downloads', component: DownloadsScreen });
export const likesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/likes', component: LikesScreen });
export const historyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/history', component: HistoryScreen });
export const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsScreen });
export const accountRoute = createRoute({ getParentRoute: () => rootRoute, path: '/account', component: AccountScreen });
export const authRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth', component: AuthScreen });

const routeTree = rootRoute.addChildren([
	homeRoute,
	exploreRoute,
	searchRoute,
	titleRoute,
	playerRoute,
	downloadsRoute,
	likesRoute,
	historyRoute,
	settingsRoute,
	accountRoute,
	authRoute
]);

export const router = createRouter({
	routeTree,
	defaultPreload: 'intent',
	defaultPreloadStaleTime: 0
});

declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}
