import { useCallback } from 'react';
import { useSessionStore } from '../../../lib/stores/session';
import { useToastStore } from '../../../lib/stores/toast';
import { useI18n } from '../../../i18n';
import type { FileV2 } from '../../../lib/api/types';

/**
 * Copies a file's playable link. This is the LOCAL core `/stream` URL — the core
 * proxy resolves the urn and fetches the real media (routed through the bounded
 * uplink). It plays in-app and in an external player (mpv/VLC) pointed at this
 * machine. The `playUrl`/spike URL is NOT used here — it only works against the
 * device's own native proxy and is unreachable otherwise.
 */
export function useCopyLink(): (file: FileV2) => void {
	const push = useToastStore((s) => s.push);
	const { t } = useI18n();
	return useCallback(
		(file: FileV2) => {
			// Some "files" are external links (e.g. YouTube trailers) — their urn is a
			// full http(s) URL. Copy it verbatim. Real media goes through /stream.
			let url: string;
			if (/^https?:\/\//i.test(file.urn)) {
				url = file.urn;
			} else {
				const base = useSessionStore.getState().assetBase();
				if (!base) {
					push({ tone: 'info', title: t('item.linkFailed') });
					return;
				}
				url = `${base}/stream?urn=${encodeURIComponent(file.urn)}&id=${file.id}`;
			}
			void (async () => {
				await window.oskol?.clipboardWrite(url);
				push({ tone: 'success', title: t('item.linkCopied'), description: url });
			})();
		},
		[push, t]
	);
}
