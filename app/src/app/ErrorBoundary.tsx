/**
 * React ErrorBoundary for unhandled render errors. Logs locally (via lib/logger)
 * and offers a retry that resets the boundary. Wrap the routed content with this;
 * the router also has a route-level error component (router.tsx) for loader errors.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '../components/ui';
import { logError } from '../lib/logger';

interface Props {
	children: ReactNode;
	/** optional custom fallback renderer */
	fallback?: (error: unknown, reset: () => void) => ReactNode;
}

interface State {
	error: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: unknown): State {
		return { error };
	}

	componentDidCatch(error: unknown, info: ErrorInfo) {
		logError(error, { scope: 'render', title: undefined });
		// eslint-disable-next-line no-console
		console.error('ErrorBoundary caught', error, info.componentStack);
	}

	reset = () => this.setState({ error: null });

	render() {
		const { error } = this.state;
		if (error == null) return this.props.children;
		if (this.props.fallback) return this.props.fallback(error, this.reset);
		const message =
			error instanceof Error
				? error.message
				: typeof error === 'object' && error && 'message' in error
					? String((error as { message: unknown }).message)
					: String(error);
		return (
			<div className="flex min-h-[70vh] items-center justify-center p-6">
				<ErrorState message={message} onRetry={this.reset} />
			</div>
		);
	}
}
