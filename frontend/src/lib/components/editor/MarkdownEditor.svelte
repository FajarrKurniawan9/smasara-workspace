<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Markdown } from 'tiptap-markdown';
	import { Wikilink } from './wikilink-extension';
	import EditorToolbar from './EditorToolbar.svelte';
	import WikilinkModal from './WikilinkModal.svelte';

	interface Props {
		content?: string;
		placeholder?: string;
		editable?: boolean;
		onChange?: (markdown: string) => void;
		onWikilinkNavigate?: (slug: string) => void;
		availableDocuments?: Array<{ id: string; title: string; slug: string }>;
	}

	let {
		content = '',
		placeholder = 'Tulis catatan Anda di sini... Mendukung Markdown & [[wikilink]]',
		editable = true,
		onChange,
		onWikilinkNavigate,
		availableDocuments = []
	}: Props = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | null = $state(null);
	let isWikilinkModalOpen = $state(false);

	onMount(() => {
		if (!element) return;

		const ed = new Editor({
			element: element,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3, 4]
					}
				}),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'text-blue-600 underline hover:text-blue-800'
					}
				}),
				Placeholder.configure({
					placeholder
				}),
				Markdown.configure({
					html: true,
					tightLists: true,
					tightListClass: 'tight',
					bulletListMarker: '-',
					linkify: false,
					breaks: false,
					transformPastedText: true,
					transformCopiedText: true
				}),
				Wikilink
			],
			content: content,
			editable: editable,
			editorProps: {
				attributes: {
					class:
						'prose prose-emerald max-w-none focus:outline-none min-h-[350px] p-6 text-gray-800 leading-relaxed font-sans'
				},
				handleClick: (view, pos, event) => {
					const target = event.target as HTMLElement | null;
					if (target && (target.hasAttribute('data-slug') || target.closest('[data-slug]'))) {
						const el = target.hasAttribute('data-slug') ? target : target.closest('[data-slug]');
						const slug = el?.getAttribute('data-slug');
						if (slug && onWikilinkNavigate) {
							event.preventDefault();
							onWikilinkNavigate(slug);
							return true;
						}
					}
					return false;
				}
			},
			onUpdate: ({ editor: currentEditor }) => {
				const storage = currentEditor.storage as unknown as {
					markdown?: { getMarkdown: () => string };
				};
				const markdownText = storage.markdown?.getMarkdown?.() ?? currentEditor.getHTML();
				if (onChange) {
					onChange(markdownText);
				}
			}
		});

		editor = ed;
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
	});

	// Reaktif update ketika prop content berubah dari luar (misal setelah load dokumen baru)
	$effect(() => {
		if (editor && content !== undefined) {
			const storage = editor.storage as unknown as {
				markdown?: { getMarkdown: () => string };
			};
			const currentMarkdown = storage.markdown?.getMarkdown?.() ?? '';
			if (currentMarkdown !== content) {
				editor.commands.setContent(content, { emitUpdate: false });
			}
		}
	});

	// Reaktif update status editable
	$effect(() => {
		if (editor && editable !== undefined) {
			editor.setEditable(editable);
		}
	});

	function openWikilinkModal() {
		isWikilinkModalOpen = true;
	}

	function handleWikilinkSelect(slug: string, _title?: string) {
		if (!editor) return;
		// Insert wikilink text formatted
		editor
			.chain()
			.focus()
			.insertContent({
				type: 'text',
				text: `[[${slug}]]`,
				marks: [
					{
						type: 'wikilink',
						attrs: { slug }
					}
				]
			})
			.run();
	}

	export function getMarkdown(): string {
		if (!editor) return '';
		const storage = editor.storage as unknown as {
			markdown?: { getMarkdown: () => string };
		};
		return storage.markdown?.getMarkdown?.() ?? editor.getHTML();
	}

	export function setMarkdown(newMarkdown: string) {
		if (!editor) return;
		editor.commands.setContent(newMarkdown, { emitUpdate: false });
	}
</script>

<div
	class="relative flex flex-col rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden"
>
	{#if editable}
		<EditorToolbar {editor} onInsertWikilink={openWikilinkModal} />
	{/if}

	<div bind:this={element} class="w-full flex-1 overflow-y-auto cursor-text"></div>

	<WikilinkModal
		isOpen={isWikilinkModalOpen}
		onClose={() => (isWikilinkModalOpen = false)}
		onSelect={handleWikilinkSelect}
		{availableDocuments}
	/>
</div>

<style>
	:global(.tiptap p.is-editor-empty:first-child::before) {
		color: #9ca3af;
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	:global(.tiptap blockquote) {
		border-left: 3px solid #10b981;
		padding-left: 1rem;
		font-style: italic;
		color: #4b5563;
	}

	:global(.tiptap pre) {
		background: #1f2937;
		color: #f3f4f6;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	:global(.tiptap code) {
		background-color: #f3f4f6;
		padding: 0.15rem 0.3rem;
		border-radius: 0.25rem;
		font-size: 0.85em;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	:global(.tiptap pre code) {
		background: transparent;
		padding: 0;
	}
</style>
