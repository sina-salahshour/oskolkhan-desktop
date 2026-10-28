<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import type { Session } from '$lib/api';
	import { session } from '$lib/stores/session.svelte';
	import { preload } from '$lib/stores/preload.svelte';
	import { t } from '$lib/i18n';
	import Icon from '$lib/components/Icon.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import TelegramModal from '$lib/components/auth/TelegramModal.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state<'email' | 'google' | 'guest' | null>(null);
	let telegramOpen = $state(false);

	async function run(kind: 'email' | 'google' | 'guest', fn: () => Promise<Session>) {
		if (busy) return;
		busy = kind;
		error = '';
		try {
			const result = await fn();
			session.set(result);
			await goto('/');
		} catch (e) {
			error = (e as { message?: string })?.message || t('auth.failed');
		} finally {
			busy = null;
		}
	}

	function signIn() {
		if (!email.trim() || !password) {
			error = t('auth.failed');
			return;
		}
		run('email', () => api.authEmail(email.trim(), password));
	}
</script>

<div class="screen">
	<div class="glow g1"></div>
	<div class="glow g2"></div>

	<main class="card">
		<div class="logo"><Icon name="film" size={30} /></div>
		<h1>{t('auth.title')}</h1>
		<p class="sub">{t('auth.subtitle')}</p>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				signIn();
			}}
		>
			<Field
				bind:value={email}
				type="email"
				icon="mail"
				label={t('auth.email')}
				placeholder={t('auth.emailPlaceholder')}
				autofocus
			/>
			<Field bind:value={password} type="password" icon="lock" label={t('auth.password')} />
			{#if error}
				<p class="error" role="alert"><Icon name="info" size={16} /> {error}</p>
			{/if}
			<Button
				type="submit"
				variant="primary"
				size="lg"
				block
				loading={busy === 'email'}
				disabled={!!busy && busy !== 'email'}
			>
				{t('auth.loginEmail')}
			</Button>
		</form>

		<div class="divider"><span>{t('auth.or')}</span></div>

		<div class="alt">
			<div class="stagger-in" style="--i:1">
				<Button
					variant="secondary"
					size="lg"
					icon="google"
					block
					loading={busy === 'google'}
					disabled={!!busy && busy !== 'google'}
					onclick={() => run('google', () => api.authGoogle())}
				>
					{t('auth.loginGoogle')}
				</Button>
			</div>
			<div class="stagger-in" style="--i:2">
				<Button
					variant="secondary"
					size="lg"
					icon="telegram"
					block
					disabled={!!busy}
					onclick={() => (telegramOpen = true)}
				>
					{t('auth.loginTelegram')}
				</Button>
			</div>
			{#if preload.enableGuest}
				<div class="stagger-in" style="--i:3">
					<Button
						variant="ghost"
						size="lg"
						icon="user"
						block
						loading={busy === 'guest'}
						disabled={!!busy && busy !== 'guest'}
						onclick={() => run('guest', () => api.authGuest())}
					>
						{t('auth.loginGuest')}
					</Button>
				</div>
				{#if preload.data?.GuestNotice}
					<p class="notice">{preload.data.GuestNotice}</p>
				{/if}
			{/if}
		</div>
	</main>
</div>

<TelegramModal bind:open={telegramOpen} />

<style>
	.screen {
		position: relative;
		min-block-size: 100vh;
		display: grid;
		place-items: center;
		padding: var(--sp-5);
		overflow: hidden;
		background:
			radial-gradient(ellipse at 50% 0%, var(--surface-2), transparent 70%),
			linear-gradient(160deg, var(--bg), var(--bg-deep));
	}
	.glow {
		position: absolute;
		border-radius: 50%;
		filter: blur(120px);
		background: var(--accent-soft);
		pointer-events: none;
	}
	.g1 {
		width: 460px;
		height: 460px;
		inset-block-start: -140px;
		inset-inline-start: -120px;
	}
	.g2 {
		width: 380px;
		height: 380px;
		inset-block-end: -140px;
		inset-inline-end: -100px;
		opacity: 0.6;
	}
	.card {
		position: relative;
		width: min(100%, 420px);
		padding: var(--sp-7) var(--sp-6);
		display: flex;
		flex-direction: column;
		gap: var(--sp-4);
		background: var(--elevated);
		border: 1px solid var(--border);
		border-radius: var(--r-xl, var(--r-lg));
		box-shadow: var(--shadow-lg);
		backdrop-filter: blur(18px);
		animation: rise 0.5s var(--ease) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(16px) scale(0.98);
		}
	}
	@keyframes shake {
		25% {
			transform: translateX(-4px);
		}
		75% {
			transform: translateX(4px);
		}
	}
	.logo {
		align-self: center;
		display: grid;
		place-items: center;
		width: 60px;
		height: 60px;
		border-radius: var(--r-lg);
		background: var(--accent);
		color: var(--on-accent);
		box-shadow: 0 8px 28px var(--accent-soft);
		transition: transform var(--dur) var(--ease-spring, var(--ease));
	}
	.logo:hover {
		transform: rotate(-6deg) scale(1.06);
	}
	h1 {
		text-align: center;
		font-size: 1.5rem;
		font-weight: 800;
	}
	.sub {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.9rem;
		margin-block-end: var(--sp-2);
	}
	form,
	.alt {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}
	.error {
		animation: shake 0.32s var(--ease);
		display: flex;
		align-items: center;
		gap: var(--sp-2);
		color: var(--danger);
		font-size: 0.85rem;
	}
	.divider {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
		color: var(--text-dim);
		font-size: 0.8rem;
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}
	.notice {
		text-align: center;
		color: var(--text-dim);
		font-size: 0.78rem;
	}
</style>
