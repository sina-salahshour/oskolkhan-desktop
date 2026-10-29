/**
 * App root — the DEFAULT export mounted by src/main.tsx (Worker A). It wires the
 * providers (QueryClient + theme + i18n + tooltip + toaster) around the
 * RouterProvider; the router's root route renders the AppShell with the sidebar,
 * topbar, command palette and boot overlay.
 */
import { RouterProvider } from '@tanstack/react-router';
import { AppProviders } from './providers';
import { ErrorBoundary } from './ErrorBoundary';
import { router } from './router';

export default function App() {
	return (
		<ErrorBoundary>
			<AppProviders>
				<RouterProvider router={router} />
			</AppProviders>
		</ErrorBoundary>
	);
}
