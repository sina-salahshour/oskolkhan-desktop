/**
 * Telegram sign-in: starts a session, shows a (decorative) QR + the bot link,
 * and polls every 5s until the login is confirmed, then sets the session and
 * navigates home. Errors surface through the global toast; we also show inline.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Send, ExternalLink } from '@lucide/react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	Button,
	Spinner,
	Icon
} from '@/components/ui';
import { useTelegramStart, useTelegramPoll } from '@/lib/query';
import { usePreload } from '@/lib/query';
import { isApiError } from '@/lib/api';
import { useI18n } from '@/i18n';

const POLL_MS = 5000;
// deterministic pseudo-QR pattern (13×13)
const CELLS = Array.from({ length: 169 }, (_, i) => (i * 7 + ((i * i) % 11)) % 3 !== 0);

export function TelegramDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
	const { t } = useI18n();
	const navigate = useNavigate();
	const start = useTelegramStart();
	const poll = useTelegramPoll();
	const preload = usePreload();

	const [botUrl, setBotUrl] = useState('');
	const [error, setError] = useState('');
	const doneRef = useRef(false);

	useEffect(() => {
		if (!open) return;
		doneRef.current = false;
		setError('');
		setBotUrl(preload.data?.BotUrl ?? '');
		let cancelled = false;
		let timer: ReturnType<typeof setInterval> | undefined;

		const finish = (session: unknown) => {
			if (!session || doneRef.current || cancelled) return;
			doneRef.current = true;
			if (timer) clearInterval(timer);
			onOpenChange(false);
			void navigate({ to: '/' });
		};

		start
			.mutateAsync()
			.then((r) => {
				if (cancelled) return;
				if (r?.botUrl) setBotUrl(r.botUrl);
				timer = setInterval(() => {
					poll
						.mutateAsync()
						.then((s) => finish(s))
						.catch(() => {
							/* keep polling; global toast handles reporting */
						});
				}, POLL_MS);
			})
			.catch((e: unknown) => {
				if (!cancelled) setError(isApiError(e) ? e.message : t('auth.failed'));
			});

		return () => {
			cancelled = true;
			if (timer) clearInterval(timer);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	function openExternal() {
		if (!botUrl) return;
		if (window.oskol?.openExternal) void window.oskol.openExternal(botUrl);
		else window.open(botUrl, '_blank', 'noopener');
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent size="sm">
				<DialogHeader>
					<DialogTitle>{t('auth.loginTelegram')}</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col items-center gap-4 text-center">
					<p className="text-sm text-muted">{t('auth.telegramScan')}</p>

					<div className="relative rounded-xl bg-white p-3 shadow-lg">
						<div className="grid h-44 w-44 grid-cols-[repeat(13,1fr)] gap-px">
							{CELLS.map((on, i) => (
								<span key={i} className={on ? 'rounded-[1px] bg-[#0b0b0d]' : ''} />
							))}
						</div>
						<div className="absolute left-1/2 top-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md border-4 border-white bg-accent text-accent-fg">
							<Icon icon={Send} size={24} />
						</div>
					</div>

					{botUrl ? (
						<code dir="ltr" className="break-all font-latin text-xs text-subtle">
							{botUrl}
						</code>
					) : null}

					{error ? (
						<p role="alert" className="text-sm text-danger">
							{error}
						</p>
					) : (
						<Spinner size={20} label={t('auth.telegramWaiting')} />
					)}
					{!error ? <p className="text-xs text-muted">{t('auth.telegramWaiting')}</p> : null}

					{botUrl ? (
						<Button fullWidth leftIcon={ExternalLink} onClick={openExternal}>
							{t('auth.telegramOpen')}
						</Button>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	);
}
