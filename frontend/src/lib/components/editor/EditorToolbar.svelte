<script lang="ts">
	import type { Editor } from '@tiptap/core';

	interface Props {
		editor: Editor | null;
		onInsertWikilink?: () => void;
	}

	let { editor, onInsertWikilink }: Props = $props();

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
</script>

{#if editor}
	<div
		class="sticky top-0 z-10 flex flex-wrap items-center gap-1.5 border-b border-zinc-200/80 bg-white/90 px-3.5 py-2 backdrop-blur-md"
	>
		<!-- Text Style / Headings -->
		<div class="flex items-center gap-1 border-r border-zinc-200/80 pr-2">
			<button
				type="button"
				onclick={() => editor?.chain().focus().setParagraph().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {editor.isActive(
					'paragraph'
				) && !editor.isActive('heading')
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Paragraph"
			>
				P
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97] {editor.isActive(
					'heading',
					{
						level: 1
					}
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97] {editor.isActive(
					'heading',
					{
						level: 2
					}
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
				class="rounded-lg px-2.5 py-1 text-xs font-semibold transition-all active:scale-[0.97] {editor.isActive(
					'heading',
					{
						level: 3
					}
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Heading 3"
			>
				H3
			</button>
		</div>

		<!-- Formatting (Bold, Italic, Strike, Code) -->
		<div class="flex items-center gap-1 border-r border-zinc-200/80 pr-2">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBold().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-bold transition-all active:scale-[0.97] {editor.isActive(
					'bold'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Bold (Ctrl+B)"
			>
				B
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				class="rounded-lg px-2.5 py-1 text-xs italic transition-all active:scale-[0.97] {editor.isActive(
					'italic'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Italic (Ctrl+I)"
			>
				I
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleStrike().run()}
				class="rounded-lg px-2.5 py-1 text-xs line-through transition-all active:scale-[0.97] {editor.isActive(
					'strike'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Strikethrough"
			>
				S
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleCode().run()}
				class="rounded-lg font-mono px-2 py-1 text-xs transition-all active:scale-[0.97] {editor.isActive(
					'code'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Inline Code"
			>
				&lt;/&gt;
			</button>
		</div>

		<!-- Lists & Quote -->
		<div class="flex items-center gap-1 border-r border-zinc-200/80 pr-2">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBulletList().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {editor.isActive(
					'bulletList'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Bullet List"
			>
				• List
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {editor.isActive(
					'orderedList'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Numbered List"
			>
				1. List
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBlockquote().run()}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {editor.isActive(
					'blockquote'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Blockquote"
			>
				&ldquo; Quote
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
				class="rounded-lg font-mono px-2 py-1 text-xs transition-all active:scale-[0.97] {editor.isActive(
					'codeBlock'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Code Block"
			>
				Block Code
			</button>
		</div>

		<!-- Links & Wikilinks -->
		<div class="flex items-center gap-1.5 border-r border-zinc-200/80 pr-2">
			<button
				type="button"
				onclick={setLink}
				class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all active:scale-[0.97] {editor.isActive(
					'link'
				)
					? 'bg-zinc-900 text-white shadow-2xs'
					: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
				title="Insert Link"
			>
				Link
			</button>

			<button
				type="button"
				onclick={onInsertWikilink}
				class="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-2xs transition-all hover:border-zinc-300 hover:bg-white hover:text-zinc-900 active:scale-[0.97]"
				title="Sisipkan Wikilink [[catatan]]"
			>
				<span class="font-mono text-[11px] text-zinc-400">[[ ]]</span>
				<span>Wikilink</span>
			</button>
		</div>

		<!-- Undo / Redo -->
		<div class="ml-auto flex items-center gap-1">
			<button
				type="button"
				onclick={() => editor?.chain().focus().undo().run()}
				disabled={!editor.can().undo()}
				class="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
				title="Undo"
			>
				↺
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().redo().run()}
				disabled={!editor.can().redo()}
				class="rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30"
				title="Redo"
			>
				↻
			</button>
		</div>
	</div>
{/if}
