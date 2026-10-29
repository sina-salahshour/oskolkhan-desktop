/**
 * Tiny allowlist HTML sanitizer for FAQ answers (no external deps).
 *
 * Parses untrusted HTML with DOMParser, walks the tree and keeps only a small
 * set of formatting tags. Everything else is unwrapped (its text is kept) and
 * all attributes are dropped except a vetted `href` on `<a>`. Links are forced
 * to open safely in a new tab. Returns the cleaned innerHTML string.
 */

/** Tags we keep; anything else is unwrapped (children preserved). */
const ALLOWED_TAGS = new Set([
	'p',
	'br',
	'b',
	'strong',
	'i',
	'em',
	'u',
	'a',
	'ul',
	'ol',
	'li',
	'span',
	'h3',
	'h4'
]);

/** Keep only http(s) or relative hrefs; reject javascript:, data:, etc. */
function isSafeHref(raw: string): boolean {
	const value = raw.trim();
	if (value === '') return false;
	// Relative / anchor / query links are safe.
	if (/^(?:[/#?]|\.{1,2}\/)/.test(value)) return true;
	// Scheme-bearing links: allow only http/https.
	const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(value);
	if (schemeMatch) {
		const scheme = schemeMatch[1].toLowerCase();
		return scheme === 'http' || scheme === 'https';
	}
	// No scheme and not obviously relative (e.g. "example.com/x") -> treat as relative.
	return true;
}

function sanitizeElement(el: Element, doc: Document): void {
	// Recurse first (snapshot children, since we mutate during the walk).
	for (const child of Array.from(el.childNodes)) {
		if (child.nodeType === Node.ELEMENT_NODE) {
			sanitizeElement(child as Element, doc);
		} else if (child.nodeType !== Node.TEXT_NODE) {
			// Drop comments, CDATA, processing instructions, etc.
			child.parentNode?.removeChild(child);
		}
	}

	const tag = el.tagName.toLowerCase();

	if (!ALLOWED_TAGS.has(tag)) {
		// Unwrap: replace the element with its (already sanitized) children.
		const parent = el.parentNode;
		if (parent) {
			while (el.firstChild) parent.insertBefore(el.firstChild, el);
			parent.removeChild(el);
		}
		return;
	}

	// Strip every attribute, then restore only a safe href on <a>.
	const keptHref = tag === 'a' ? el.getAttribute('href') : null;
	for (const attr of Array.from(el.attributes)) {
		el.removeAttribute(attr.name);
	}

	if (tag === 'a') {
		if (keptHref != null && isSafeHref(keptHref)) {
			el.setAttribute('href', keptHref.trim());
		}
		el.setAttribute('target', '_blank');
		el.setAttribute('rel', 'noopener noreferrer');
	}
}

export function sanitizeHtml(html: string): string {
	if (!html) return '';
	if (typeof DOMParser === 'undefined') {
		// SSR / non-DOM fallback: strip all tags, keep text.
		return html.replace(/<[^>]*>/g, '');
	}
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const body = doc.body;
	if (!body) return '';
	for (const child of Array.from(body.childNodes)) {
		if (child.nodeType === Node.ELEMENT_NODE) {
			sanitizeElement(child as Element, doc);
		} else if (child.nodeType !== Node.TEXT_NODE) {
			child.parentNode?.removeChild(child);
		}
	}
	return body.innerHTML;
}
