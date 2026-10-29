/**
 * Auth screen: email/password, Google, Telegram (QR + poll) and guest (gated by
 * the PreLoad `EnableGuestLogin` flag; the TV-only Hide* flags are ignored). On
 * success the session is set (by the useAuth hook) and we navigate home. Errors
 * surface through the global toast; inline text mirrors the last failure.
 * Default export = AuthScreen (router wires it to /auth).
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { Clapperboard, Mail, Lock, LogIn, Send, UserRound, Info } from '@lucide/react';
import { Button, Field, Input, Icon } from '@/components/ui';
import { useAuth, usePreload, type AuthInput } from '@/lib/query';
import { isApiError } from '@/lib/api';
import { useI18n } from '@/i18n';
import { TelegramDialog } from './TelegramDialog';

type Kind = 'email' | 'google' | 'guest';

export default function AuthScreen() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const reduce = useReducedMotion();
	const auth = useAuth();
	const preload = usePreload();

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [localError, setLocalError] = useState('');
	const [pending, setPending] = useState<Kind | null>(null);
	const [telegramOpen, setTelegramOpen] = useState(false);

	const error =
		localError || (auth.isError ? (isApiError(auth.error) ? auth.error.message : t('auth.failed')) : '');

	function run(kind: Kind, input: AuthInput) {
		if (pending) return;
		setLocalError('');
		setPending(kind);
		auth.mutate(input, {
			onSuccess: () => void navigate({ to: '/' }),
			onSettled: () => setPending(null)
		});
	}

	function signInEmail() {
		if (!email.trim() || !password) {
			setLocalError(t('auth.failed'));
			return;
		}
		run('email', { kind: 'email', userName: email.trim(), password });
	}

	const guestEnabled = preload.data?.EnableGuestLogin ?? false;
	const guestNotice = preload.data?.GuestNotice ?? false;

	return (
		<div className="flex min-h-full items-center justify-center p-5">
			<motion.main
				initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: reduce ? 0 : 0.4, ease: 'easeOut' }}
				className="flex w-full max-w-[420px] flex-col gap-4 rounded-2xl border border-line bg-surface p-7 shadow-lg"
			>
				<div className="flex flex-col items-center gap-3">
					<motion.span
						whileHover={reduce ? undefined : { rotate: -6, scale: 1.06 }}
						className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-accent-fg"
					>
						<Icon icon={Clapperboard} size={28} />
					</motion.span>
					<h1 className="text-center text-2xl font-extrabold text-fg">{t('auth.title')}</h1>
					<p className="text-center text-sm text-muted">{t('auth.subtitle')}</p>
				</div>

				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						signInEmail();
					}}
				>
					<Field label={t('auth.email')} htmlFor="auth-email">
						<Input
							id="auth-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder={t('auth.emailPlaceholder')}
							leftIcon={Mail}
							dir="ltr"
							autoFocus
						/>
					</Field>
					<Field label={t('auth.password')} htmlFor="auth-password">
						<Input
							id="auth-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							leftIcon={Lock}
							dir="ltr"
						/>
					</Field>

					{error ? (
						<motion.p
							role="alert"
							initial={reduce ? false : { x: -4 }}
							animate={{ x: 0 }}
							className="flex items-center gap-2 text-sm text-danger"
						>
							<Icon icon={Info} size={16} />
							{error}
						</motion.p>
					) : null}

					<Button
						type="submit"
						size="lg"
						fullWidth
						loading={pending === 'email'}
						disabled={!!pending && pending !== 'email'}
					>
						{t('auth.loginEmail')}
					</Button>
				</form>

				<div className="flex items-center gap-3 text-xs text-subtle">
					<span className="h-px flex-1 bg-line" />
					{t('auth.or')}
					<span className="h-px flex-1 bg-line" />
				</div>

				<div className="flex flex-col gap-3">
					<Button
						variant="outline"
						size="lg"
						fullWidth
						leftIcon={LogIn}
						loading={pending === 'google'}
						disabled={!!pending && pending !== 'google'}
						onClick={() => run('google', { kind: 'google' })}
					>
						{t('auth.loginGoogle')}
					</Button>
					<Button
						variant="outline"
						size="lg"
						fullWidth
						leftIcon={Send}
						disabled={!!pending}
						onClick={() => setTelegramOpen(true)}
					>
						{t('auth.loginTelegram')}
					</Button>
					{guestEnabled ? (
						<>
							<Button
								variant="ghost"
								size="lg"
								fullWidth
								leftIcon={UserRound}
								loading={pending === 'guest'}
								disabled={!!pending && pending !== 'guest'}
								onClick={() => run('guest', { kind: 'guest' })}
							>
								{t('auth.loginGuest')}
							</Button>
							{guestNotice ? <p className="text-center text-xs text-subtle">{t('auth.guestNotice')}</p> : null}
						</>
					) : null}
				</div>
			</motion.main>

			<TelegramDialog open={telegramOpen} onOpenChange={setTelegramOpen} />
		</div>
	);
}
