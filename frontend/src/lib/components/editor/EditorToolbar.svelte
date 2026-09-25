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
		class="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white/95 px-3 py-2 backdrop-blur-sm"
	>
		<!-- Text Style / Headings -->
		<div class="flex items-center gap-0.5 border-r border-gray-200 pr-1.5">
			<button
				type="button"
				onclick={() => editor?.chain().focus().setParagraph().run()}
				class="rounded px-2 py-1 text-xs font-medium transition-colors {editor.isActive(
					'paragraph'
				) && !editor.isActive('heading')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Paragraph"
			>
				P
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				class="rounded px-2 py-1 text-xs font-bold transition-colors {editor.isActive('heading', {
					level: 1
				})
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				class="rounded px-2 py-1 text-xs font-bold transition-colors {editor.isActive('heading', {
					level: 2
				})
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
				class="rounded px-2 py-1 text-xs font-bold transition-colors {editor.isActive('heading', {
					level: 3
				})
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Heading 3"
			>
				H3
			</button>
		</div>

		<!-- Formatting (Bold, Italic, Strike, Code) -->
		<div class="flex items-center gap-0.5 border-r border-gray-200 pr-1.5">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBold().run()}
				class="rounded px-2 py-1 text-xs font-bold transition-colors {editor.isActive('bold')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Bold (Ctrl+B)"
			>
				B
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				class="rounded px-2 py-1 text-xs italic transition-colors {editor.isActive('italic')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Italic (Ctrl+I)"
			>
				I
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleStrike().run()}
				class="rounded px-2 py-1 text-xs line-through transition-colors {editor.isActive('strike')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Strikethrough"
			>
				S
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleCode().run()}
				class="rounded font-mono px-2 py-1 text-xs transition-colors {editor.isActive('code')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Inline Code"
			>
				&lt;/&gt;
			</button>
		</div>

		<!-- Lists & Quote -->
		<div class="flex items-center gap-0.5 border-r border-gray-200 pr-1.5">
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBulletList().run()}
				class="rounded px-2 py-1 text-xs transition-colors {editor.isActive('bulletList')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Bullet List"
			>
				• List
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				class="rounded px-2 py-1 text-xs transition-colors {editor.isActive('orderedList')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Numbered List"
			>
				1. List
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleBlockquote().run()}
				class="rounded px-2 py-1 text-xs transition-colors {editor.isActive('blockquote')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Blockquote"
			>
				&ldquo; Quote
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
				class="rounded font-mono px-2 py-1 text-xs transition-colors {editor.isActive('codeBlock')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Code Block"
			>
				Block Code
			</button>
		</div>

		<!-- Links & Wikilinks -->
		<div class="flex items-center gap-1 border-r border-gray-200 pr-1.5">
			<button
				type="button"
				onclick={setLink}
				class="rounded px-2 py-1 text-xs transition-colors {editor.isActive('link')
					? 'bg-emerald-100 text-emerald-800'
					: 'text-gray-600 hover:bg-gray-100'}"
				title="Insert Link"
			>
				Link
			</button>

			<button
				type="button"
				onclick={onInsertWikilink}
				class="rounded bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
				title="Sisipkan Wikilink [[catatan]]"
			>
				<span>[[ ]]</span>
				<span>Wikilink</span>
			</button>
		</div>

		<!-- Undo / Redo -->
		<div class="flex items-center gap-0.5 ml-auto">
			<button
				type="button"
				onclick={() => editor?.chain().focus().undo().run()}
				disabled={!editor.can().undo()}
				class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40"
				title="Undo"
			>
				↺
			</button>
			<button
				type="button"
				onclick={() => editor?.chain().focus().redo().run()}
				disabled={!editor.can().redo()}
				class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40"
				title="Redo"
			>
				↻
			</button>
		</div>
	</div>
{/if}
