/** Likes screen. Default export = LikesScreen (router wires it to /likes). */
import { Heart } from '@lucide/react';
import { useLikes, useLike } from '@/lib/query';
import { useI18n } from '@/i18n';
import { LibraryList } from '../LibraryList';

export default function LikesScreen() {
	const { t } = useI18n();
	const query = useLikes(0);
	const like = useLike();

	return (
		<LibraryList
			heading={t('likes.title')}
			emptyIcon={Heart}
			emptyTitle={t('likes.empty')}
			query={query}
			onRemove={(id) => like.mutateAsync({ category: 0, item: id, on: false, status: 0 })}
		/>
	);
}
