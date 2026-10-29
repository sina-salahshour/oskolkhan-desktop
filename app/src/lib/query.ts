/**
 * TanStack Query (v5) hooks + mutations over the RPC client. Feature screens use
 * ONLY these hooks (never the client directly) so caching, polling, invalidation
 * and the global error policy stay consistent.
 *
 * All errors flow through the global QueryCache/MutationCache handlers wired in
 * app/providers.tsx (toast + local log). Hooks here just declare keys + fetchers.
 */
import {
	useQuery,
	useInfiniteQuery,
	useMutation,
	useQueryClient
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { client } from './api/client';
import type {
	CoreStatus,
	Session,
	SearchArgs,
	LikeArgs,
	WatchArgs,
	GetMoreArgs,
	PlayUrlArgs
} from './api/contract';
import type { GetMore } from './api/types';
import { useSessionStore } from './stores/session';

// --- query keys ----------------------------------------------------------

export const qk = {
	coreStatus: ['core_status'] as const,
	preload: ['preload'] as const,
	session: ['session'] as const,
	home: (page: number) => ['home', page] as const,
	item: (id: number) => ['item', id] as const,
	itemDetail: (id: number) => ['itemDetail', id] as const,
	files: (id: number) => ['files', id] as const,
	faq: ['faq'] as const,
	search: (args: SearchArgs) => ['search', args] as const,
	likes: (type: number) => ['likes', type] as const,
	watches: (type: number) => ['watches', type] as const,
	getMore: (args: Omit<GetMoreArgs, 'page'>) => ['getMore', args] as const,
	adProfile: ['adProfile'] as const,
	contentTypes: ['contentTypes'] as const
};

/**
 * A small, safe subset of query options callers may pass through. We deliberately
 * avoid the full UseQueryOptions generics (whose TData/select interplay is brittle
 * across @tanstack/react-query minor versions) — screens that need more can call
 * useQuery directly with the exported `qk` keys + `client`.
 */
interface QOpts<T> {
	enabled?: boolean;
	staleTime?: number;
	gcTime?: number;
	refetchInterval?: number | false;
	placeholderData?: T | ((prev: T | undefined) => T | undefined);
	meta?: Record<string, unknown>;
}

interface InfOpts {
	enabled?: boolean;
	staleTime?: number;
	gcTime?: number;
	meta?: Record<string, unknown>;
}

// --- status (polling) ----------------------------------------------------

/**
 * Polls core_status every ~1.5s while booting, slows to 30s once ready, and
 * mirrors the latest status into the session store (assetBase / loggedIn).
 */
export function useCoreStatus(opts?: QOpts<CoreStatus>) {
	const setStatus = useSessionStore((s) => s.setStatus);
	const q = useQuery<CoreStatus>({
		queryKey: qk.coreStatus,
		queryFn: () => client.coreStatus(),
		refetchInterval: (query) => {
			const phase = query.state.data?.phase;
			return phase === 'ready' ? 30_000 : 1500;
		},
		refetchIntervalInBackground: true,
		staleTime: 0,
		retry: false,
		...opts
	});
	useEffect(() => {
		if (q.data) setStatus(q.data);
	}, [q.data, setStatus]);
	return q;
}

// --- config / session ----------------------------------------------------

export function usePreload(opts?: QOpts<Awaited<ReturnType<typeof client.preload>>>) {
	return useQuery({ queryKey: qk.preload, queryFn: () => client.preload(), staleTime: 5 * 60_000, ...opts });
}

export function useSession(opts?: QOpts<Session | null>) {
	const setSession = useSessionStore((s) => s.setSession);
	const q = useQuery<Session | null>({
		queryKey: qk.session,
		queryFn: () => client.session(),
		staleTime: 60_000,
		...opts
	});
	useEffect(() => {
		setSession(q.data ?? null);
	}, [q.data, setSession]);
	return q;
}

export function useFaq(opts?: QOpts<Awaited<ReturnType<typeof client.faq>>>) {
	return useQuery({ queryKey: qk.faq, queryFn: () => client.faq(), staleTime: 10 * 60_000, ...opts });
}

export function useContentTypes(opts?: QOpts<Awaited<ReturnType<typeof client.getContentTypes>>>) {
	return useQuery({ queryKey: qk.contentTypes, queryFn: () => client.getContentTypes(), staleTime: 10 * 60_000, ...opts });
}

export function useAdProfile(opts?: QOpts<Awaited<ReturnType<typeof client.adProfile>>>) {
	return useQuery({ queryKey: qk.adProfile, queryFn: () => client.adProfile(), staleTime: 30_000, ...opts });
}

// --- content -------------------------------------------------------------

export function useHome(page = 0, opts?: QOpts<Awaited<ReturnType<typeof client.home>>>) {
	return useQuery({ queryKey: qk.home(page), queryFn: () => client.home(page), ...opts });
}

export function useItem(id: number, opts?: QOpts<Awaited<ReturnType<typeof client.item>>>) {
	return useQuery({ queryKey: qk.item(id), queryFn: () => client.item(id), enabled: id > 0, ...opts });
}

export function useItemDetail(id: number, opts?: QOpts<Awaited<ReturnType<typeof client.itemDetail>>>) {
	return useQuery({
		queryKey: qk.itemDetail(id),
		queryFn: () => client.itemDetail(id),
		enabled: id > 0,
		...opts
	});
}

export function useFiles(id: number, opts?: QOpts<Awaited<ReturnType<typeof client.files>>>) {
	return useQuery({ queryKey: qk.files(id), queryFn: () => client.files(id), enabled: id > 0, ...opts });
}

export function useSearch(args: SearchArgs, opts?: QOpts<Awaited<ReturnType<typeof client.search>>>) {
	return useQuery({
		queryKey: qk.search(args),
		queryFn: () => client.search(args),
		enabled: args.phrase.trim().length > 0,
		placeholderData: (prev) => prev,
		...opts
	});
}

const nextPage = (last: GetMore, all: GetMore[]) => (last?.hasmove ? all.length : undefined);

/** Explore / "see all" endpoint, paginated. */
export function useGetMore(args: Omit<GetMoreArgs, 'page'>, opts?: InfOpts) {
	// Home-section "see all" endpoints (featured, latestmovies, …) are 1-indexed:
	// page 0 is the data already shown inline on the home screen, so the backend
	// 404s a getmore for page 0. The advanced-filter endpoint is 0-indexed. Start
	// each infinite query at its first valid page and advance from there.
	const start = args.endpoint === 'filter' ? 0 : 1;
	return useInfiniteQuery({
		queryKey: qk.getMore(args),
		queryFn: ({ pageParam }) => client.getMore({ ...args, page: pageParam }),
		initialPageParam: start,
		getNextPageParam: (last: GetMore, all: GetMore[]) => (last?.hasmove ? start + all.length : undefined),
		enabled: args.endpoint.length > 0,
		...opts
	});
}

export function useLikes(type: number, opts?: InfOpts) {
	return useInfiniteQuery({
		queryKey: qk.likes(type),
		queryFn: ({ pageParam }) => client.likes(type, pageParam),
		initialPageParam: 0,
		getNextPageParam: nextPage,
		...opts
	});
}

export function useWatches(type: number, opts?: InfOpts) {
	return useInfiniteQuery({
		queryKey: qk.watches(type),
		queryFn: ({ pageParam }) => client.watches(type, pageParam),
		initialPageParam: 0,
		getNextPageParam: nextPage,
		...opts
	});
}

// --- mutations -----------------------------------------------------------

export function useLike() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (args: LikeArgs) => client.like(args),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['likes'] });
		}
	});
}

export function useWatch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (args: WatchArgs) => client.watch(args),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['watches'] });
		}
	});
}

export function useRemoveWatch() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (tid: number) => client.removeWatch(tid),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['watches'] });
		}
	});
}

export function usePlayUrl() {
	return useMutation({ mutationFn: (args: PlayUrlArgs) => client.playUrl(args) });
}

export function useSetBirth() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (value: string) => client.setBirth(value),
		onSuccess: (session) => {
			qc.setQueryData(qk.session, session);
			useSessionStore.getState().setSession(session);
		}
	});
}

export function useSetContentTypes() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (value: number) => client.setContentTypes(value),
		onSuccess: (session) => {
			qc.setQueryData(qk.session, session);
			useSessionStore.getState().setSession(session);
		}
	});
}

/** Email / Google / guest auth collapse into one mutation keyed by `kind`. */
export type AuthInput =
	| { kind: 'email'; userName: string; password: string }
	| { kind: 'guest' }
	| { kind: 'google' };

export function useAuth() {
	const qc = useQueryClient();
	return useMutation<Session, unknown, AuthInput>({
		mutationFn: (input) => {
			switch (input.kind) {
				case 'email':
					return client.authEmail(input.userName, input.password);
				case 'guest':
					return client.authGuest();
				case 'google':
					return client.authGoogle();
			}
		},
		onSuccess: (session) => {
			qc.setQueryData(qk.session, session);
			useSessionStore.getState().setSession(session);
			void qc.invalidateQueries({ queryKey: qk.coreStatus });
		}
	});
}

export function useTelegramStart() {
	return useMutation({ mutationFn: () => client.authTelegramStart() });
}

export function useTelegramPoll() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => client.authTelegramPoll(),
		onSuccess: (session) => {
			if (session) {
				qc.setQueryData(qk.session, session);
				useSessionStore.getState().setSession(session);
			}
		}
	});
}

export function useLogout() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => client.logout(),
		onSuccess: () => {
			qc.setQueryData(qk.session, null);
			useSessionStore.getState().setSession(null);
			void qc.invalidateQueries();
		}
	});
}

export function useImportKickstart() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (path: string) => client.importKickstart(path),
		onSuccess: (status) => {
			qc.setQueryData(qk.coreStatus, status);
			useSessionStore.getState().setStatus(status);
		}
	});
}
