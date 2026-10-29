import type { ItemDetail, PreLoad } from '../../../lib/api/types';
import { useI18n } from '../../../i18n';
import { compact, digits, runtime } from '../lib/format';

export function ExtraDetail({ detail, pre }: { detail: ItemDetail; pre: PreLoad | undefined }) {
	const { t, lang } = useI18n();
	const rows: { label: string; value: string }[] = [];
	const network = detail.network.map((n) => n.title1).filter(Boolean).join('، ');
	if (network) rows.push({ label: t('title.network'), value: network });
	const country = pre?.countries?.[detail.country] ?? '';
	if (country) rows.push({ label: t('title.country'), value: country });
	const langs = detail.language.map((l) => pre?.languages?.[l] ?? '').filter(Boolean).join('، ');
	if (langs) rows.push({ label: t('title.language'), value: langs });
	if (detail.runtime) rows.push({ label: t('title.runtime'), value: runtime(detail.runtime, lang) });
	if (detail.Budget > 0) rows.push({ label: t('title.budget'), value: `$${compact(detail.Budget, lang)}` });
	if (detail.Revenue > 0) rows.push({ label: t('title.revenue'), value: `$${compact(detail.Revenue, lang)}` });
	const status = pre?.seriesstatus?.[detail.status] ?? '';
	if (status) rows.push({ label: t('title.status'), value: digits(status, lang) });
	if (rows.length === 0) return null;
	return (
		<dl className="divide-y divide-line rounded-lg border border-line bg-surface">
			{rows.map((r) => (
				<div key={r.label} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
					<dt className="shrink-0 text-muted">{r.label}</dt>
					<dd className="min-w-0 text-end text-fg">{r.value}</dd>
				</div>
			))}
		</dl>
	);
}
