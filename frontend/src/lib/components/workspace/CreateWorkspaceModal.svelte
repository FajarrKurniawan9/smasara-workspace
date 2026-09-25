<script lang="ts">
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onCreate: (name: string) => Promise<void>;
	}

	let { isOpen, onClose, onCreate }: Props = $props();

	let workspaceName = $state('');
	let isSubmitting = $state(false);
	let errorMsg = $state('');

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const name = workspaceName.trim();
		if (!name) {
			errorMsg = 'Nama workspace tidak boleh kosong';
			return;
		}

		try {
			isSubmitting = true;
			errorMsg = '';
			await onCreate(name);
			workspaceName = '';
			onClose();
		} catch (err: unknown) {
			errorMsg = err instanceof Error ? err.message : 'Gagal membuat workspace';
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
		<div
			class="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl transition-all"
		>
			<div class="flex items-center justify-between pb-3 border-b border-gray-100">
				<h3 class="text-base font-semibold text-gray-800">Buat Workspace Baru</h3>
				<button
					type="button"
					onclick={onClose}
					class="text-gray-400 hover:text-gray-600 rounded p-1 hover:bg-gray-100 text-lg leading-none"
				>
					&times;
				</button>
			</div>

			{#if errorMsg}
				<div class="mt-3 rounded-md bg-red-50 p-2.5 text-xs text-red-600">
					{errorMsg}
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="mt-4 space-y-4">
				<div>
					<label for="ws-name" class="block text-xs font-medium text-gray-700 mb-1">
						Nama Workspace
					</label>
					<input
						id="ws-name"
						type="text"
						bind:value={workspaceName}
						placeholder="Misal: Catatan Pribadi, Riset AI..."
						required
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={onClose}
						class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
					>
						Batal
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
					>
						{isSubmitting ? 'Membuat...' : 'Buat Workspace'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
