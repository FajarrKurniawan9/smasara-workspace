<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor | null;
		onInsertWikilink?: () => void;
	}

	let { editor, onInsertWikilink }: Props = $props();

	// Counter reaktif untuk memaksa re-evaluasi editor.isActive(...) saat cursor/selection/transaction berubah
	let updateTick = $state(0);

	let currentEditor: Editor | null = null;

	function handleUpdate() {
		updateTick++;
	}

	$effect(() => {
		if (editor !== currentEditor) {
			if (currentEditor) {
				currentEditor.off('transaction', handleUpdate);
				currentEditor.off('selectionUpdate', handleUpdate);
			}
			currentEditor = editor;
			if (currentEditor) {
				currentEditor.on('transaction', handleUpdate);
				currentEditor.on('selectionUpdate', handleUpdate);
				updateTick++;
			}
		}
	});

	onDestroy(() => {
		if (currentEditor) {
			currentEditor.off('transaction', handleUpdate);
			currentEditor.off('selectionUpdate', handleUpdate);
		}
	});

	function setLink() {
		if (!editor) return;
		const previousUrl = editor.getAttributes('link').href;
		const url = window.prompt('Masukkan URL:', previousUrl);

		if (url === null) return;
		if (url === '') {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
	}

	// Helper aktif dengan dependensi reaktif ke updateTick
	function isItemActive(name: string, attributes?: Record<string, unknown>) {
		// Evaluasi updateTick agar Svelte 5 runes mendeteksi perubahan
		void updateTick;
		return editor ? editor.isActive(name, attributes) : false;
	}

	function canUndo() {
		void updateTick;
		return editor ? editor.can().undo() : false;
	}

	function canRedo() {
		void updateTick;
		return editor ? editor.can().redo() : false;
	}
</script>

{#if editor}
	<div
		class="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-[var(--border-app)] bg-[var(--bg-surface)] px-3.5 py-2 backdrop-blur-md transition-colors"
	>
		<!-- Text Style / Headings -->
		<div class="flex items-center gap-1 border-r border-[var(--border-app-subtle)] pr-2">
			<button
				type="button"
				onclick={() => editor?.chain().focus().setParagraph().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {isItemActive(
					'paragraph'
				) && !isItemActive('heading')
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs font-semibold'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Paragraph"
			>
				P
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97] {isItemActive(
					'heading',
					{ level: 1 }
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs font-bold'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97] {isItemActive(
					'heading',
					{ level: 2 }
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs font-bold'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97] {isItemActive(
					'heading',
					{ level: 3 }
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs font-bold'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Heading 3"
			>
				H3
			</button>
		</div>

		<!-- Formatting (Bold, Italic, Strike, Code) -->
		<div class="flex items-center gap-1 border-r border-[var(--border-app-subtle)] pr-2">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBold().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.97] {isItemActive(
					'bold'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Bold (Ctrl+B)"
			>
				B
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				class="rounded-lg px-2.5 py-1 text-xs italic transition-all active:scale-[0.97] {isItemActive(
					'italic'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Italic (Ctrl+I)"
			>
				I
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleStrike().run()}
				class="rounded-lg px-2.5 py-1 text-xs line-through transition-all active:scale-[0.97] {isItemActive(
					'strike'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Strikethrough"
			>
				S
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleCode().run()}
				class="rounded-lg font-mono px-2 py-1 text-xs transition-all active:scale-[0.97] {isItemActive(
					'code'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Inline Code"
			>
				&lt;/&gt;
			</button>
		</div>

		<!-- Lists & Quote -->
		<div class="flex items-center gap-1 border-r border-[var(--border-app-subtle)] pr-2">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBulletList().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {isItemActive(
					'bulletList'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Bullet List"
			>
				• List
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {isItemActive(
					'orderedList'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Numbered List"
			>
				1. List
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBlockquote().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {isItemActive(
					'blockquote'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Blockquote"
			>
				&ldquo; Quote
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
				class="rounded-lg font-mono px-2 py-1 text-xs transition-all active:scale-[0.97] {isItemActive(
					'codeBlock'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Code Block"
			>
				Block Code
			</button>
		</div>

		<!-- Links & Wikilinks -->
		<div class="flex items-center gap-1.5 border-r border-[var(--border-app-subtle)] pr-2">
			<button
				type="button"
				onclick={setLink}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {isItemActive(
					'link'
				)
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-2xs'
					: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'}"
				title="Insert Link"
			>
				Link
			</button>

			<button
				type="button"
				onclick={onInsertWikilink}
				class="flex items-center gap-1 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] shadow-2xs transition-all hover:border-zinc-400 active:scale-[0.97]"
				title="Sisipkan Wikilink [[catatan]]"
			>
				<span class="font-mono text-[11px] text-[var(--text-muted)]">[[ ]]</span>
				<span>Wikilink</span>
			</button>
		</div>

		<!-- Undo / Redo -->
		<div class="ml-auto flex items-center gap-1">
			<button
				type="button"
				onclick={() => editor?.chain().focus().undo().run()}
				disabled={!canUndo()}
				class="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
				title="Undo"
			>
				↺
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().redo().run()}
				disabled={!canRedo()}
				class="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
				title="Redo"
			>
				↻
			</button>
		</div>
	</div>
{/if}
