<script lang="ts">
	let {
		isOpen = false,
		parentFolderName = '',
		onClose,
		onCreate
	}: {
		isOpen: boolean;
		parentFolderName?: string;
		onClose: () => void;
		onCreate: (name: string) => Promise<void>;
	} = $props();

	let folderName = $state('');
	let isSubmitting = $state(false);
	let errorMsg = $state('');

	$effect(() => {
		if (isOpen) {
			folderName = '';
			errorMsg = '';
		}
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const cleanName = folderName.trim();
		if (!cleanName) {
			errorMsg = 'Nama folder tidak boleh kosong';
			return;
		}

		try {
			isSubmitting = true;
			errorMsg = '';
			await onCreate(cleanName);
			onClose();
		} catch (err: unknown) {
			errorMsg = err instanceof Error ? err.message : 'Gagal membuat folder';
		} finally {
			isSubmitting = false;
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl border border-gray-100">
			<h3 class="text-base font-bold text-gray-900 mb-1">
				{parentFolderName ? `Buat Subfolder di "${parentFolderName}"` : 'Buat Folder Baru'}
			</h3>
			<p class="text-xs text-gray-500 mb-4">
				Gunakan folder untuk mengelompokkan catatan dan dokumen Anda.
			</p>

			{#if errorMsg}
				<div class="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-100">
					{errorMsg}
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="folderName" class="block text-xs font-semibold text-gray-700 mb-1">
						Nama Folder
					</label>
					<input
						type="text"
						id="folderName"
						bind:value={folderName}
						placeholder="contoh: Riset, Proyek, Harian..."
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						disabled={isSubmitting}
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={onClose}
						disabled={isSubmitting}
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs transition-colors disabled:opacity-50"
					>
						{isSubmitting ? 'Membuat...' : 'Buat Folder'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
