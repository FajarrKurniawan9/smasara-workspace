<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { fetchApi } from '$lib/api';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { children } = $props();
	let isInitializing = $state(true);

	onMount(async () => {
		try {
			// Cek sesi yang sudah ada saat halaman direload
			const me = await fetchApi('/api/me');
			auth.setAuth(me.user_id);

			// Jika user membuka halaman auth (login/register) dalam posisi sudah login,
			// lemparkan ke dashboard.
			const path = $page.url.pathname;
			if (path === '/login' || path === '/register') {
				goto('/');
			}
		} catch (_err) {
			// Gagal (belum login). Jika berada di dashboard, tendang ke login.
			auth.clearAuth();
			const path = $page.url.pathname;
			if (path !== '/login' && path !== '/register') {
				goto('/login');
			}
		} finally {
			isInitializing = false;
		}
	});
</script>

{#if isInitializing}
	<div class="flex min-h-screen items-center justify-center bg-gray-100">
		<p class="text-gray-500">Memuat Smasara...</p>
	</div>
{:else}
	{@render children()}
{/if}
