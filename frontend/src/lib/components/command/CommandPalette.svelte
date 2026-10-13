<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	let { isOpen = $bindable(false), children }: { isOpen: boolean; children: any } = $props();

	onMount(() => {
		const handleGlobalKeydown = (e: KeyboardEvent) => {
			console.log('Keydown detected', e.key, e.ctrlKey, e.metaKey);
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				console.log('Toggling palette', !isOpen);
				isOpen = !isOpen;
			}
		};
		window.addEventListener('keydown', handleGlobalKeydown);
		return () => window.removeEventListener('keydown', handleGlobalKeydown);
	});
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm"
			aria-hidden="true"
			onclick={() => (isOpen = false)}
			transition:fade={{ duration: 100 }}
		></div>

		<div
			class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-card border border-[var(--border-app)]"
			transition:slide={{ duration: 150, axis: 'y' }}
		>
			{@render children()}
		</div>
	</div>
{/if}
