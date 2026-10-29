/**
 * Home / Discovery screen. Hero carousel (section type 0 `recently`), then every
 * other HomeEntity section as a scrolling row. The continue-watching section
 * (type 1) gets a per-card progress overlay. Data via useHome(0); gated on the
 * core being ready (useCoreStatus). Default export is the screen the router wires.
 */
import { Clapperboard } from '@lucide/react';
import type { GenericTitle } from '@/lib/api';
import { useHome, useCoreStatus } from '@/lib/query';
import { isApiError } from '@/lib/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { useI18n } from '@/i18n';
import { HeroCarousel } from './components/HeroCarousel';
import { TitleRow } from './components/TitleRow';

/** Mock continue-watching progress (type-1 rows) until real watch sync lands. */
const progressFor = (section: number) =>
	section === 1 ? (tt: GenericTitle) => 0.3 + (tt.id % 5) * 0.12 : undefined;

function HomeSkeleton() {
	return (
		<div>
			<Skeleton rounded="xl" className="h-[440px] w-full" />
			<div className="mt-8 flex flex-col gap-8">
				{Array.from({ length: 3 }, (_, i) => (
					<div key={i}>
						<Skeleton className="mb-3 h-5 w-48" />
						<div className="grid grid-flow-col gap-4 [grid-auto-columns:clamp(130px,14vw,172px)]">
							{Array.from({ length: 6 }, (_, j) => (
								<div key={j} className="flex flex-col gap-2">
									<Skeleton rounded="lg" className="aspect-[2/3] w-full" />
									<Skeleton className="h-3 w-4/5" />
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function HomeScreen() {
	const { t } = useI18n();
	const ready = useCoreStatus().data?.phase === 'ready';
	const { data, isLoading, isError, error, refetch } = useHome(0, { enabled: ready });

	const content = () => {
		if (!ready || isLoading) return <HomeSkeleton />;
		if (isError)
			return (
				<ErrorState
					title={t('error.generic')}
					message={isApiError(error) ? error.message : String(error)}
					retryLabel={t('common.retry')}
					onRetry={() => void refetch()}
				/>
			);

		const sections = data?.sections ?? [];
		const hero = sections.find((s) => s.type === 0)?.recently ?? [];
		const rows = sections.filter((s) => s.type !== 0 && s.recently.length > 0);

		if (!hero.length && !rows.length)
			return <EmptyState icon={Clapperboard} title={t('home.empty')} />;

		return (
			<>
				{hero.length ? <HeroCarousel items={hero} /> : null}
				{rows.map((section, i) => (
					<TitleRow
						key={`${section.id}-${i}`}
						title={section.type === 1 ? section.title || t('home.continueWatching') : section.title}
						items={section.recently}
						moreEndpoint={section.hasmore ? section.moreendpoint : undefined}
						progressFor={progressFor(section.type)}
					/>
				))}
			</>
		);
	};

	return <div className="mx-auto w-full max-w-7xl px-4 py-6">{content()}</div>;
}
