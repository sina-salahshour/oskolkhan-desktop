/**
 * Route placeholder components (Phase 1). Each route below is wired to one of
 * these stubs. Phase-2 feature workers REPLACE the stub in router.tsx with the
 * real screen from `src/features/<feature>/` — e.g. swap `component: HomeStub`
 * for `component: HomeScreen`. Stubs intentionally live here (app/), NOT in
 * features/, and only demonstrate the hooks/ui are reachable.
 */
import { useParams } from '@tanstack/react-router';
import { Clapperboard } from '@lucide/react';
import { EmptyState } from '../components/ui';
import { useT } from '../i18n';

function Stub({ titleKey, note }: { titleKey: string; note?: string }) {
	const t = useT();
	return (
		<div className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center px-4">
			<EmptyState
				icon={Clapperboard}
				title={t(titleKey)}
				description={note ?? 'Phase 2 screen — foundation ready.'}
			/>
		</div>
	);
}

export function HomeStub() {
	return <Stub titleKey="nav.home" />;
}
export function ExploreStub() {
	return <Stub titleKey="explore.title" />;
}
export function SearchStub() {
	return <Stub titleKey="nav.search" />;
}
export function TitleStub() {
	const { id } = useParams({ from: '/title/$id' });
	return <Stub titleKey="title.files" note={`title #${id}`} />;
}
export function PlayerStub() {
	const t = useT();
	return <Stub titleKey="nav.home" note={t('player.playbackPhase2')} />;
}
export function DownloadsStub() {
	return <Stub titleKey="downloads.title" />;
}
export function LikesStub() {
	return <Stub titleKey="likes.title" />;
}
export function HistoryStub() {
	return <Stub titleKey="history.title" />;
}
export function SettingsStub() {
	return <Stub titleKey="settings.title" />;
}
export function AccountStub() {
	return <Stub titleKey="account.title" />;
}
export function AuthStub() {
	return <Stub titleKey="auth.title" />;
}
