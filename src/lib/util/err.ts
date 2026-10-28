/**
 * Turn any thrown value into a readable message. The core rejects Tauri commands
 * with a structured `{ code, message }` object (see design.md error contract), so
 * a naive `String(e)` yields "[object Object]". This extracts the real message.
 */
export function errorText(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object') {
		const o = e as Record<string, unknown>;
		if (typeof o.message === 'string' && o.message) return o.message;
		if (typeof o.code === 'string' && o.code) return o.code;
		try {
			return JSON.stringify(o);
		} catch {
			/* fall through */
		}
	}
	return String(e);
}
