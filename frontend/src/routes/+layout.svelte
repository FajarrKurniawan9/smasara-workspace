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
			const me = await fetchApi<{ user_id: string }>('/api/me');
			// Coba ambil profil untuk username (graceful fail jika profil belum dibuat)
			let username: string | null = null;
			try {
				const profileData = await fetchApi<{ profile: { username: string } }>('/api/profiles/me');
				username = profileData.profile.username;
			} catch {
				// Abaikan error jika user belum buat profil
			}
			auth.setAuth(me.user_id, username);

			// Jika user membuka halaman auth (login/register) dalam posisi sudah login,
			// lemparkan ke dashboard.
			const path = $page.url.pathname;
			if (path === '/login' || path === '/register') {
				goto('/');
			}
		} catch {
			// Gagal (belum login). Jika berada di rute private (dashboard), tendang ke login.
			// Rute publik (/@username atau rute publik lainnya) dibiarkan tetap bisa diakses tanpa login.
			auth.clearAuth();
			const path = $page.url.pathname;
			const isPublicRoute = path === '/login' || path === '/register' || path.startsWith('/@');
			if (!isPublicRoute) {
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
