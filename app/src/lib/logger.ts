/**
 * Error logger. Per the error policy, a logged error:
 *   1. shows a toast (never "[object Object]"),
 *   2. calls window.oskol.log({...}) so it lands in the local app.log file,
 *   3. console.error()s for the devtools.
 *
 * `logError` normalizes any thrown value into a human string and an ApiError-ish
 * code, so callers can pass raw caught errors.
 */
import { isApiError } from './api/contract';
import type { ApiError, ApiErrorCode } from './api/contract';
import { toast } from './stores/toast';
import type { LogLevel } from './oskol';

/** Map an unknown thrown value to a stable `{ code, message }`. */
export function normalizeError(e: unknown): ApiError {
	if (isApiError(e)) return e;
	if (e instanceof Error) return { code: 'server', message: e.message };
	if (typeof e === 'string') return { code: 'server', message: e };
	if (e && typeof e === 'object') {
		const m = (e as { message?: unknown }).message;
		if (typeof m === 'string') return { code: 'server', message: m };
	}
	return { code: 'server', message: 'Unknown error' };
}

export interface LogOptions {
	scope: string;
	/** suppress the toast (e.g. background refetch errors) */
	silent?: boolean;
	/** override the toast title (otherwise a localized-ish default is used) */
	title?: string;
	level?: LogLevel;
}

/** Fallback human titles per error code (English; UI can re-localize via i18n keys). */
const CODE_TITLES: Record<ApiErrorCode, string> = {
	notReady: 'The core is not ready yet',
	network: 'Network error',
	auth: 'Please sign in again',
	server: 'Something went wrong',
	decode: 'Could not read the response',
	unimplemented: 'Not available yet'
};

export function logError(e: unknown, opts: LogOptions): ApiError {
	const { code, message } = normalizeError(e);
	const level = opts.level ?? 'error';
	const ts = Date.now();

	// 3. devtools
	// eslint-disable-next-line no-console
	console.error(`[${opts.scope}] ${code}: ${message}`, e);

	// 2. local log file via the preload bridge (best-effort)
	try {
		window.oskol?.log({ level, scope: opts.scope, code, message, ts });
	} catch {
		/* bridge unavailable; toast + console still fire */
	}

	// 1. toast
	if (!opts.silent) {
		toast({
			tone: level === 'warn' ? 'warning' : 'error',
			title: opts.title ?? CODE_TITLES[code],
			description: message
		});
	}

	return { code, message };
}

/** Informational local log (no toast unless asked). */
export function logInfo(scope: string, message: string, extra?: Record<string, unknown>) {
	// eslint-disable-next-line no-console
	console.info(`[${scope}] ${message}`, extra ?? '');
	try {
		window.oskol?.log({ level: 'info', scope, message, ts: Date.now(), ...(extra ?? {}) });
	} catch {
		/* ignore */
	}
}
