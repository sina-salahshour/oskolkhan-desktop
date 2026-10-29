import { Plus, X } from '@lucide/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
	IconButton,
	SegmentedControl,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Slider,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { usePlayerStore } from '../../../lib/stores/player';
import { digits } from '../lib/format';
import { usePlayerChrome, type PanelKind, type SubtitleEdge } from '../store';

const FONT_OPTIONS = [
	{ value: 'Vazirmatn', label: 'Vazirmatn' },
	{ value: 'Estedad', label: 'Estedad' },
	{ value: 'Inter', label: 'Inter' },
];
const EDGE_OPTIONS: { value: SubtitleEdge; label: string }[] = [
	{ value: 'none', label: 'None' },
	{ value: 'outline', label: 'Outline' },
	{ value: 'drop', label: 'Drop' },
	{ value: 'raised', label: 'Raised' },
];
const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30];

function isEdge(v: string): v is SubtitleEdge {
	return v === 'none' || v === 'outline' || v === 'drop' || v === 'raised';
}

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-xs text-muted">
				<span>{label}</span>
				{value ? <span dir="ltr">{value}</span> : null}
			</div>
			{children}
		</div>
	);
}

export function SubtitlePanel() {
	const { t, lang, dir } = useI18n();
	const reduce = useReducedMotion();
	const panel = usePlayerChrome((s) => s.panel);
	const style = usePlayerChrome((s) => s.subtitleStyle);
	const sync = usePlayerChrome((s) => s.subtitleSync);
	const patch = usePlayerChrome((s) => s.patch);
	const patchStyle = usePlayerChrome((s) => s.patchStyle);
	const patchSync = usePlayerChrome((s) => s.patchSync);
	const position = usePlayerStore((s) => s.position);

	const offset = dir === 'rtl' ? -40 : 40;
	const close = () => patch({ panel: null });

	return (
		<AnimatePresence>
			{panel ? (
				<motion.aside
					key="subtitle-panel"
					role="dialog"
					aria-label={panel === 'style' ? t('player.subtitleStyle') : t('player.subtitleSync')}
					className="absolute inset-y-0 end-0 z-30 flex w-[340px] max-w-full flex-col gap-4 overflow-y-auto border-s border-line bg-surface p-4 text-fg shadow-lg"
					initial={reduce ? { opacity: 0 } : { opacity: 0, x: offset }}
					animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
					exit={reduce ? { opacity: 0 } : { opacity: 0, x: offset }}
					transition={{ duration: reduce ? 0.1 : 0.22 }}
					onPointerDown={(e) => e.stopPropagation()}
				>
					<header className="flex items-center justify-between">
						<h3 className="text-base font-semibold">
							{panel === 'style' ? t('player.subtitleStyle') : t('player.subtitleSync')}
						</h3>
						<IconButton icon={X} label={t('common.close')} size="sm" onClick={close} />
					</header>
					<Tabs value={panel} onValueChange={(v) => patch({ panel: v as PanelKind })}>
						<TabsList>
							<TabsTrigger value="style">{t('player.subtitleStyle')}</TabsTrigger>
							<TabsTrigger value="sync">{t('player.subtitleSync')}</TabsTrigger>
						</TabsList>
						<TabsContent value="style" className="space-y-5 pt-4">
							<Row label={t('player.font')}>
								<SegmentedControl
									size="sm"
									options={FONT_OPTIONS}
									value={style.font}
									onValueChange={(v: string) => patchStyle({ font: v })}
								/>
							</Row>
							<Row label={t('player.fontSize')} value={`${digits(style.size, lang)}%`}>
								<Slider
									size="sm"
									min={50}
									max={220}
									step={5}
									value={[style.size]}
									aria-label={t('player.fontSize')}
									onValueChange={(v: number[]) => patchStyle({ size: v[0] ?? 100 })}
								/>
							</Row>
							<Row label={t('player.position')} value={`${digits(style.position, lang)}%`}>
								<Slider
									size="sm"
									min={0}
									max={80}
									step={1}
									value={[style.position]}
									aria-label={t('player.position')}
									onValueChange={(v: number[]) => patchStyle({ position: v[0] ?? 0 })}
								/>
							</Row>
							<Row label={t('player.edge')}>
								<SegmentedControl
									size="sm"
									options={EDGE_OPTIONS}
									value={style.edge}
									onValueChange={(v: string) => {
										if (isEdge(v)) patchStyle({ edge: v });
									}}
								/>
							</Row>
							<Row label={t('player.background')} value={`${digits(style.background, lang)}%`}>
								<Slider
									size="sm"
									min={0}
									max={100}
									step={5}
									value={[style.background]}
									aria-label={t('player.background')}
									onValueChange={(v: number[]) => patchStyle({ background: v[0] ?? 0 })}
								/>
							</Row>
							<label className="flex items-center justify-between text-xs text-muted">
								<span>Color</span>
								<input
									type="color"
									value={style.color}
									aria-label="Color"
									onChange={(e) => patchStyle({ color: e.target.value })}
									className="h-8 w-12 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
								/>
							</label>
						</TabsContent>
						<TabsContent value="sync" className="space-y-5 pt-4">
							<Row label={t('player.syncDelay')} value={`${digits(sync.delayMs, lang)}ms`}>
								<Slider
									size="sm"
									min={-10000}
									max={10000}
									step={100}
									value={[sync.delayMs]}
									aria-label={t('player.syncDelay')}
									onValueChange={(v: number[]) => patchSync({ delayMs: v[0] ?? 0 })}
								/>
							</Row>
							<Row label={t('player.syncFps')}>
								<Select value={String(sync.fps)} onValueChange={(v: string) => patchSync({ fps: Number(v) })}>
									<SelectTrigger aria-label={t('player.syncFps')}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{FPS_OPTIONS.map((f) => (
											<SelectItem key={f} value={String(f)}>
												{digits(f, lang)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Row>
							<Row
								label={t('player.syncPoints')}
								value={sync.points.length ? digits(sync.points.length, lang) : t('common.none')}
							>
								<IconButton
									icon={Plus}
									variant="subtle"
									size="sm"
									label={t('player.syncPoints')}
									onClick={() => patchSync({ points: [...sync.points, { at: position, shift: sync.delayMs }] })}
								/>
							</Row>
						</TabsContent>
					</Tabs>
				</motion.aside>
			) : null}
		</AnimatePresence>
	);
}
