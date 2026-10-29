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
				// Retry only transient failures (notReady/network/server), max 3 times.
				// Never retry auth/decode/unimplemented or anything else.
				retry: (count, error) => {
					if (count >= 3) return false;
					if (!isApiError(error)) return false;
					return error.code === 'notReady' || error.code === 'network' || error.code === 'server';
				},
				// Exponential backoff (1s,2s,4s...) capped at 30s, with 50-100% jitter.
				retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000) * (0.5 + Math.random() * 0.5),
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
