/** Watch-history screen. Default export = HistoryScreen (router wires it to /history). */
import { Clock } from '@lucide/react';
import { useWatches, useRemoveWatch } from '@/lib/query';
import { useI18n } from '@/i18n';
import { LibraryList } from '../LibraryList';

export default function HistoryScreen() {
	const { t } = useI18n();
	const query = useWatches(0);
	const removeWatch = useRemoveWatch();

	return (
		<LibraryList
			heading={t('history.title')}
			emptyIcon={Clock}
			emptyTitle={t('history.empty')}
			query={query}
			showProgress
			onRemove={(id) => removeWatch.mutateAsync(id)}
		/>
	);
}
