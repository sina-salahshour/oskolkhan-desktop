/**
 * Boot / splash overlay driven by core_status. Shown while the core is
 * starting/bootstrapping, and as an error/offline panel (with Retry + import
 * kickstart) when it fails. Fades out once phase === 'ready'. Covers the app.
 */
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { WifiOff, TriangleAlert, FileUp, RotateCcw } from '@lucide/react';
import { useCoreStatus, useImportKickstart } from '../lib/query';
import { useT } from '../i18n';
import { Button, Spinner, Icon } from '../components/ui';

export function BootOverlay() {
	const t = useT();
	const reduce = useReducedMotion();
	const { data, refetch, isFetching } = useCoreStatus();
	const importKickstart = useImportKickstart();

	const phase = data?.phase ?? 'starting';
	const ready = phase === 'ready';
	const failed = phase === 'offline' || phase === 'error';
	const booting = phase === 'starting' || phase === 'bootstrapping';

	const onImport = async () => {
		const path = await window.oskol?.pickFile();
		if (path) importKickstart.mutate(path);
	};

	return (
		<AnimatePresence>
			{!ready && (
				<motion.div
					initial={{ opacity: 1 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduce ? 0 : 0.4 }}
					className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-bg px-6 text-center"
					role="status"
					aria-live="polite"
				>
					<motion.div
						initial={reduce ? false : { opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: reduce ? 0 : 0.35 }}
						className="flex w-full max-w-md flex-col items-center gap-5"
					>
						<div className="text-2xl font-semibold tracking-tight text-fg">{t('app.name')}</div>

						{booting && (
							<>
								<Spinner size={28} className="text-accent" />
								<p className="text-sm text-muted">
									{t(phase === 'bootstrapping' ? 'boot.bootstrapping' : 'boot.starting')}
									{data?.message ? ` · ${data.message}` : ''}
								</p>
							</>
						)}

						{failed && (
							<>
								<Icon
									icon={phase === 'offline' ? WifiOff : TriangleAlert}
									size={40}
									className="text-danger"
								/>
								<div className="space-y-1">
									<p className="text-base font-medium text-fg">
										{t(phase === 'offline' ? 'boot.offline' : 'boot.error')}
									</p>
									<p className="text-sm text-muted">{data?.message || t('boot.offlineHint')}</p>
								</div>
								<div className="flex flex-wrap items-center justify-center gap-2">
									<Button
										variant="solid"
										leftIcon={RotateCcw}
										loading={isFetching}
										onClick={() => void refetch()}
									>
										{t('common.retry')}
									</Button>
									<Button
										variant="outline"
										leftIcon={FileUp}
										loading={importKickstart.isPending}
										onClick={() => void onImport()}
									>
										{t('boot.importKickstart')}
									</Button>
								</div>
								<p className="max-w-sm text-xs text-subtle">{t('boot.importHint')}</p>
							</>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
