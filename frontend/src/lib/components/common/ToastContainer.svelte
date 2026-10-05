<script lang="ts">
	import { toast } from '$lib/stores/toast.svelte';
	import { fly } from 'svelte/transition';

	function getToastStyle(type: string): {
		bg: string;
		border: string;
		text: string;
		iconPath: string;
	} {
		switch (type) {
			case 'success':
				return {
					bg: 'bg-emerald-50',
					border: 'border-emerald-200',
					text: 'text-emerald-800',
					iconPath: 'M5 13l4 4L19 7'
				};
			case 'error':
				return {
					bg: 'bg-rose-50',
					border: 'border-rose-200',
					text: 'text-rose-800',
					iconPath: 'M6 18L18 6M6 6l12 12'
				};
			case 'warning':
				return {
					bg: 'bg-amber-50',
					border: 'border-amber-200',
					text: 'text-amber-800',
					iconPath:
						'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
				};
			default:
				return {
					bg: 'bg-gray-50',
					border: 'border-gray-200',
					text: 'text-gray-800',
					iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
				};
		}
	}
</script>

<div
	class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
	aria-live="polite"
	data-testid="toast-container"
>
	{#each toast.toasts as t (t.id)}
		{@const style = getToastStyle(t.type)}
		<div
			class="pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all {style.bg} {style.border} {style.text}"
			role={t.type === 'error' ? 'alert' : 'status'}
			data-testid="toast-item"
			data-type={t.type}
			transition:fly={{ y: 20, duration: 200 }}
		>
			<div class="flex items-start gap-2.5 min-w-0">
				<svg
					class="w-4 h-4 shrink-0 mt-0.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d={style.iconPath} />
				</svg>
				<p class="text-xs font-medium leading-relaxed break-words">{t.message}</p>
			</div>

			<button
				type="button"
				onclick={() => toast.dismiss(t.id)}
				class="shrink-0 p-1 -mr-1 -mt-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors cursor-pointer"
				aria-label="Tutup notifikasi"
			>
				<svg
					class="w-3.5 h-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
