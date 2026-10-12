<script lang="ts">
	interface Props {
		isOpen: boolean;
		initialUrl?: string;
		initialText?: string;
		isEditing?: boolean;
		onClose: () => void;
		onSave: (data: { url: string; text: string }) => void;
		onUnlink?: () => void;
	}

	let {
		isOpen = false,
		initialUrl = '',
		initialText = '',
		isEditing = false,
		onClose,
		onSave,
		onUnlink
	}: Props = $props();

	let url = $state('');
	let text = $state('');
	let urlInputRef: HTMLInputElement | null = $state(null);

	// Sinkronisasi nilai input ketika modal dibuka
	$effect(() => {
		if (isOpen) {
			url = initialUrl || '';
			text = initialText || '';
			// Auto focus input URL setelah render
			setTimeout(() => {
				urlInputRef?.focus();
				urlInputRef?.select();
			}, 50);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (isOpen && e.key === 'Escape') {
			onClose();
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmedUrl = url.trim();
		if (!trimmedUrl) {
			if (isEditing && onUnlink) {
				onUnlink();
			}
			return;
		}

		onSave({
			url: trimmedUrl,
			text: text.trim()
		});
	}

	function handleUnlink() {
		if (onUnlink) {
			onUnlink();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-labelledby="link-modal-title"
		data-testid="link-modal"
	>
		<!-- Backdrop click handler -->
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-transparent"
			tabindex="-1"
			aria-label="Tutup modal"
			onclick={onClose}
		></button>

		<div
			class="relative w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-5"
		>
			<!-- Header Modal -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex items-center gap-3">
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
							<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
						</svg>
					</div>
					<div>
						<h3 id="link-modal-title" class="text-base font-semibold text-[var(--text-primary)]">
							{isEditing ? 'Edit Tautan' : 'Sisipkan Tautan'}
						</h3>
						<p class="text-xs text-[var(--text-muted)]">
							{isEditing
								? 'Perbarui alamat URL atau hapus tautan ini'
								: 'Tambahkan tautan web atau rujukan eksternal'}
						</p>
					</div>
				</div>

				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
					aria-label="Tutup modal tautan"
					data-testid="link-modal-close-btn"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<!-- Form Input -->
			<form onsubmit={handleSubmit} class="space-y-4">
				<div class="space-y-1.5">
					<label
						for="link-url-input"
						class="block text-xs font-medium text-[var(--text-secondary)]"
					>
						URL Tautan <span class="text-red-500">*</span>
					</label>
					<div class="relative">
						<input
							id="link-url-input"
							type="text"
							bind:this={urlInputRef}
							bind:value={url}
							placeholder="https://contoh.com"
							required
							class="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--text-primary)]"
							data-testid="link-modal-url-input"
						/>
					</div>
				</div>

				<div class="space-y-1.5">
					<label
						for="link-text-input"
						class="block text-xs font-medium text-[var(--text-secondary)]"
					>
						Teks Ditampilkan (Opsional)
					</label>
					<input
						id="link-text-input"
						type="text"
						bind:value={text}
						placeholder="Biarkan kosong untuk menggunakan URL"
						class="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--text-primary)]"
						data-testid="link-modal-text-input"
					/>
					<p class="text-[11px] text-[var(--text-muted)]">
						Bila dikosongkan, teks tautan akan otomatis mengikuti alamat URL.
					</p>
				</div>

				<!-- Action Buttons -->
				<div class="flex items-center justify-end gap-2.5 pt-2">
					{#if isEditing && onUnlink}
						<button
							type="button"
							onclick={handleUnlink}
							class="mr-auto inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 active:scale-[0.98]"
							data-testid="link-modal-unlink-btn"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
								<path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
								<line x1="2" y1="2" x2="22" y2="22" />
							</svg>
							<span>Hapus Tautan</span>
						</button>
					{/if}

					<button
						type="button"
						onclick={onClose}
						class="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] active:scale-[0.98]"
						data-testid="link-modal-cancel-btn"
					>
						Batal
					</button>

					<button
						type="submit"
						disabled={!url.trim()}
						class="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-medium text-[var(--bg-surface)] shadow-xs transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
						data-testid="link-modal-save-btn"
					>
						{isEditing ? 'Perbarui Tautan' : 'Simpan Tautan'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
