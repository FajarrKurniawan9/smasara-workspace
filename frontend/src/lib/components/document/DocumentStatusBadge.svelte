<script lang="ts">
	import type { DocumentPipelineStatus } from '$lib/types';

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
</script>

<span
	class="inline-flex items-center gap-1.5 rounded-full font-medium transition-colors select-none {size ===
	'xs'
		? 'px-2 py-0.5 text-[10px]'
		: size === 'md'
			? 'px-3 py-1 text-xs'
			: 'px-2.5 py-0.5 text-[11px]'} {status === 'live'
		? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs'
		: status === 'shared'
			? 'bg-sky-50 text-sky-700 border border-sky-200/80 shadow-2xs'
			: 'bg-slate-50 text-slate-600 border border-slate-200/70 shadow-2xs'}"
	title={tooltip}
	data-status={status}
	role="status"
	aria-label={label}
>
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
			<!-- Globe / World icon -->
			<svg
				class="h-3 w-3 shrink-0 text-emerald-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
				/>
			</svg>
		{:else if status === 'shared'}
			<!-- Users / Collaboration icon -->
			<svg
				class="h-3 w-3 shrink-0 text-sky-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.999-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
				/>
			</svg>
		{:else}
			<!-- Lock / Private icon -->
			<svg
				class="h-3 w-3 shrink-0 text-slate-500"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
				/>
			</svg>
		{/if}
	{/if}

	<!-- Label Text -->
	{#if showLabel}
		<span class="tracking-tight">{label}</span>
	{/if}
</span>
