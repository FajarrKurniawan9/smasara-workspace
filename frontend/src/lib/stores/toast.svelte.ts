export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
	duration: number;
}

type TimerId = number | ReturnType<typeof setTimeout>;

class ToastStore {
	toasts = $state<ToastItem[]>([]);
	private timers = new Map<string, TimerId>();

	show(message: string, type: ToastType = 'info', duration = 3500): string {
		const id = Math.random().toString(36).substring(2, 9);
		const newToast: ToastItem = { id, message, type, duration };
		this.toasts = [...this.toasts, newToast];

		if (duration > 0) {
			const timer = setTimeout(() => {
				this.dismiss(id);
			}, duration);
			this.timers.set(id, timer);
		}

		return id;
	}

	success(message: string, duration = 3500): string {
		return this.show(message, 'success', duration);
	}

	error(message: string, duration = 4500): string {
		return this.show(message, 'error', duration);
	}

	info(message: string, duration = 3500): string {
		return this.show(message, 'info', duration);
	}

	warning(message: string, duration = 4000): string {
		return this.show(message, 'warning', duration);
	}

	dismiss(id: string): void {
		const timer = this.timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(id);
		}
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	clear(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
		this.toasts = [];
	}
}

export const toast = new ToastStore();
