/**
 * App providers. Creates the QueryClient with the GLOBAL error policy wired into
 * the QueryCache/MutationCache (toast + local log + console, via lib/logger), then
 * nests ThemeProvider, I18nProvider and the Radix TooltipProvider, and mounts the
 * Toaster. The router is provided separately by App.tsx (this wraps it).
 */
import { useState, type ReactNode } from 'react';
import {
	QueryClient,
	QueryClientProvider,
	QueryCache,
	MutationCache
} from '@tanstack/react-query';
import { ThemeProvider } from './theme';
import { I18nProvider } from '../i18n';
import { TooltipProvider, Toaster } from '../components/ui';
import { logError } from '../lib/logger';
import { isApiError } from '../lib/api/contract';

function keyScope(queryKey: readonly unknown[] | undefined): string {
	if (!queryKey || !queryKey.length) return 'query';
	return String(queryKey[0]);
}

export function createQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: (count, error) => {
					// Never retry auth/unimplemented; retry transient network/server a bit.
					if (isApiError(error) && (error.code === 'auth' || error.code === 'unimplemented')) {
						return false;
					}
					return count < 2;
				},
				staleTime: 30_000,
				refetchOnWindowFocus: false
			},
			mutations: {
				retry: false
			}
		},
		queryCache: new QueryCache({
			onError: (error, query) => {
				const silent = query.meta?.silent === true;
				logError(error, { scope: `query:${keyScope(query.queryKey)}`, silent });
			}
		}),
		mutationCache: new MutationCache({
			onError: (error, _vars, _ctx, mutation) => {
				const scope = (mutation.options.meta?.scope as string | undefined) ?? 'mutation';
				logError(error, { scope });
			}
		})
	});
}

export function AppProviders({ children }: { children: ReactNode }) {
	// One client per app instance (kept stable across renders).
	const [queryClient] = useState(() => createQueryClient());

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<I18nProvider>
					<TooltipProvider>
						{children}
						<Toaster />
					</TooltipProvider>
				</I18nProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}
