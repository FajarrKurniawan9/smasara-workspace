<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
	import { fetchApi } from '$lib/api';
	import { goto } from '$app/navigation';

	let { children } = $props();
	let isLoggingOut = $state(false);

	async function handleLogout() {
		try {
			isLoggingOut = true;
			// Kalau belum ada endpoint logout di backend, panggil saja buat jaga-jaga
			// atau cukup bersihkan auth state dan redireksi ke login.
			// Tapi untuk HTTP-only cookie, backend harus menghapusnya.
			// Asumsikan router auth.go backend punya /api/logout
			await fetchApi('/api/logout', { method: 'POST' }).catch(() => {});
		} finally {
			auth.clearAuth();
			goto('/login');
			isLoggingOut = false;
		}
	}
</script>

<div class="flex h-screen overflow-hidden bg-gray-50">
	<!-- Sidebar -->
	<aside
		class="w-64 flex-shrink-0 border-r border-gray-200 bg-white shadow-sm flex flex-col hidden md:flex"
	>
		<div
			class="flex h-16 items-center border-b border-gray-200 px-6 font-bold text-gray-800 text-lg"
		>
			Smasara
		</div>
		<div class="flex-1 overflow-y-auto p-4">
			<nav class="space-y-1">
				<a
					href="/"
					class="block rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900"
				>
					Workspace
				</a>
				<div class="pt-4 pb-2">
					<p class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Folders</p>
					<!-- Placeholder for Nested Folders -->
					<div class="mt-2 space-y-1 pl-3">
						<button
							class="w-full text-left block rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
						>
							📁 Uncategorized
						</button>
					</div>
				</div>
			</nav>
		</div>
		<div class="border-t border-gray-200 p-4">
			<button
				onclick={handleLogout}
				disabled={isLoggingOut}
				class="w-full rounded bg-red-50 text-red-600 px-4 py-2 text-sm text-center font-medium hover:bg-red-100 disabled:opacity-50"
			>
				{isLoggingOut ? '...' : 'Logout'}
			</button>
		</div>
	</aside>

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Topbar -->
		<header
			class="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm"
		>
			<div class="flex items-center md:hidden">
				<button class="text-gray-500 hover:text-gray-700 focus:outline-none">
					<!-- Menu icon for mobile -->
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>
				<span class="ml-4 font-bold text-gray-800">Smasara</span>
			</div>

			<div class="hidden md:flex ml-auto items-center space-x-4">
				<span class="text-sm text-gray-500">
					user: {auth.userId ? auth.userId.substring(0, 8) + '...' : 'Unknown'}
				</span>
			</div>
		</header>

		<!-- Main Content Scrollable Area -->
		<main class="flex-1 overflow-y-auto p-6 bg-gray-50">
			{@render children()}
		</main>
	</div>
</div>
