/**
 * Minimal className combiner (clsx-like) with no external deps. Accepts strings,
 * arrays and conditional objects; falsy values are dropped. We deliberately keep
 * this dependency-free so the design system does not require clsx/tailwind-merge.
 */
export type ClassValue =
	| string
	| number
	| null
	| false
	| undefined
	| ClassValue[]
	| Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
	const out: string[] = [];
	for (const input of inputs) {
		if (!input) continue;
		if (typeof input === 'string' || typeof input === 'number') {
			out.push(String(input));
		} else if (Array.isArray(input)) {
			const inner = cn(...input);
			if (inner) out.push(inner);
		} else if (typeof input === 'object') {
			for (const key in input) {
				if (input[key]) out.push(key);
			}
		}
	}
	return out.join(' ');
}
