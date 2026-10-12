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
			class="w-full max-w-sm rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-5 shadow-xl transition-all text-[var(--text-primary)]"
		>
			<div
				class="flex items-center justify-between pb-3 border-b border-[var(--border-app-subtle)]"
			>
				<h3 class="text-base font-semibold text-[var(--text-primary)]">Buat Workspace Baru</h3>
				<button
					type="button"
					onclick={onClose}
					class="text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg p-1 hover:bg-[var(--bg-surface-subtle)] text-lg leading-none transition-colors"
				>
					&times;
				</button>
			</div>

			{#if errorMsg}
				<div
					class="mt-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-500 border border-red-500/20"
				>
					{errorMsg}
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="mt-4 space-y-4">
				<div>
					<label for="ws-name" class="block text-xs font-medium text-[var(--text-secondary)] mb-1">
						Nama Workspace
					</label>
					<input
						id="ws-name"
						type="text"
						bind:value={workspaceName}
						placeholder="Misal: Catatan Pribadi, Riset AI..."
						required
						class="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>

				<div class="flex items-center justify-end gap-2 pt-2">
					<button type="button" onclick={onClose} class="btn-ghost"> Batal </button>
					<button
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
