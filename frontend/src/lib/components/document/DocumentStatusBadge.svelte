<script lang="ts">
	import type { DocumentPipelineStatus } from '$lib/types';
	import { Badge } from '$lib/components/ui';

	let {
		status = 'private',
		size = 'sm',
		showIcon = true,
		showLabel = true,
		collaboratorCount = 0
	}: {
		status: DocumentPipelineStatus;
		size?: 'xs' | 'sm' | 'md';
		showIcon?: boolean;
		showLabel?: boolean;
		collaboratorCount?: number;
	} = $props();

	let label = $derived.by(() => {
		switch (status) {
			case 'live':
				return 'Live (Publik)';
			case 'shared':
				return collaboratorCount > 1 ? `Shared (${collaboratorCount})` : 'Shared (Draf)';
			case 'private':
			default:
				return 'Private';
		}
	});

	let tooltip = $derived.by(() => {
		switch (status) {
			case 'live':
				return 'Dokumen ini dipublikasikan dan dapat diakses publik';
			case 'shared':
				return collaboratorCount > 1
					? `Draf bersama, dapat diakses ${collaboratorCount} anggota workspace`
					: 'Draf bersama di dalam workspace';
			case 'private':
			default:
				return 'Catatan pribadi, hanya dapat diakses oleh Anda';
		}
	});

	const badgeColor = $derived(
		status === 'live' ? 'emerald' : status === 'shared' ? 'sky' : 'slate'
	);
</script>

<span
	class="inline-flex items-center gap-1.5 transition-colors select-none"
	title={tooltip}
	data-status={status}
	role="status"
	aria-label={label}
>
	<Badge color={badgeColor} size={size === 'md' ? 'sm' : 'xs'}>
		<!-- Status Indicator Dot -->
		<span class="relative flex h-1.5 w-1.5 shrink-0">
			{#if status === 'live'}
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
				></span>
				<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
			{:else if status === 'shared'}
				<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500"></span>
			{:else}
				<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-slate-400"></span>
			{/if}
		</span>

		<!-- Status Icon (Optional) -->
		{#if showIcon}
			{#if status === 'live'}
				<svg class="h-3 w-3 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
					/>
				</svg>
			{:else if status === 'shared'}
				<svg class="h-3 w-3 shrink-0 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h7v-2.03c0-1.02.66-1.95 1.68-2.31-.9-.23-1.68-.66-1.68-1.66zM16 13c-2.33 0-7 1.17-7 3.5V19h14v-2.03c0-1.02-.66-1.95-1.68-2.31-.9-.23-1.68-.66-1.68-1.66z"
					/>
				</svg>
			{:else}
				<svg class="h-3 w-3 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"
					/>
				</svg>
			{/if}
		{/if}

		<!-- Label Text -->
		{#if showLabel}
			<span class="tracking-tight ml-1">{label}</span>
		{/if}
	</Badge>
</span>
