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
	import LinkModal from './LinkModal.svelte';
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
	let isLinkModalOpen = $state(false);
	let linkModalInitialUrl = $state('');
	let linkModalInitialText = $state('');
	let isEditingLink = $state(false);
	let savedSelection = $state<{ from: number; to: number } | null>(null);
	onMount(() => {
		if (!element) return;

		const ed = new Editor({
			element: element,
			extensions: [
				StarterKit.configure({
					heading: {
						levels: [1, 2, 3, 4]
					},
					link: false
				}),
				Link.configure({
					openOnClick: false,
					isAllowedUri: (url) => Boolean(url),
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
						'prose max-w-none focus:outline-none min-h-[350px] p-6 text-[var(--text-primary)] leading-relaxed smasara-editor-content'
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

	function openLinkModal() {
		if (!editor) return;
		const hasLink = editor.isActive('link');
		if (hasLink) {
			// Perluas seleksi agar melingkupi seluruh mark link saat kursor berada di dalam link
			editor.chain().extendMarkRange('link').run();
		}
		const { from, to } = editor.state.selection;
		savedSelection = { from, to };
		const selectedText = editor.state.doc.textBetween(from, to, ' ');
		const previousUrl = editor.getAttributes('link').href || '';

		linkModalInitialUrl = previousUrl;
		linkModalInitialText = selectedText;
		isEditingLink = Boolean(hasLink);
		isLinkModalOpen = true;
	}

	function handleSaveLink({ url, text }: { url: string; text: string }) {
		if (!editor) return;

		let href = url.trim();
		const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href);
		if (href && !hasScheme && !href.startsWith('/') && !href.startsWith('#')) {
			href = `https://${href}`;
		}

		if (!href) {
			handleUnlink();
			return;
		}

		const sel = savedSelection ?? editor.state.selection;

		if (isEditingLink) {
			// Pulihkan dan pastikan seleksi mencakup seluruh mark link yang sedang diedit
			editor.chain().focus().setTextSelection(sel).extendMarkRange('link').run();
			const linkSel = editor.state.selection;
			const currentText = editor.state.doc.textBetween(linkSel.from, linkSel.to, ' ');
			const newText = text.trim();

			if (!newText || newText === currentText) {
				editor.chain().setLink({ href }).run();
			} else {
				editor
					.chain()
					.insertContent({
						type: 'text',
						text: newText,
						marks: [{ type: 'link', attrs: { href } }]
					})
					.run();
			}
		} else if (sel.from !== sel.to) {
			const selectedText = editor.state.doc.textBetween(sel.from, sel.to, ' ');
			const newText = text.trim();

			if (!newText || newText === selectedText) {
				editor.chain().focus().setTextSelection(sel).setLink({ href }).run();
			} else {
				editor
					.chain()
					.focus()
					.setTextSelection(sel)
					.insertContent({
						type: 'text',
						text: newText,
						marks: [{ type: 'link', attrs: { href } }]
					})
					.run();
			}
		} else {
			const linkText = text.trim() || href;
			editor
				.chain()
				.focus()
				.setTextSelection(sel)
				.insertContent({
					type: 'text',
					text: linkText,
					marks: [{ type: 'link', attrs: { href } }]
				})
				.run();
		}

		isLinkModalOpen = false;
		savedSelection = null;
	}

	function handleUnlink() {
		if (!editor) return;
		const sel = savedSelection ?? editor.state.selection;
		editor
			.chain()
			.focus()
			.setTextSelection({ from: sel.from, to: sel.to })
			.extendMarkRange('link')
			.unsetLink()
			.run();
		isLinkModalOpen = false;
		savedSelection = null;
	}

	function handleCloseLinkModal() {
		isLinkModalOpen = false;
		savedSelection = null;
		editor?.commands.focus();
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
	class="relative flex flex-col rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-xs overflow-hidden transition-colors"
>
	{#if editable}
		<EditorToolbar {editor} onInsertWikilink={openWikilinkModal} onInsertLink={openLinkModal} />
	{/if}

	<div bind:this={element} class="w-full flex-1 overflow-y-auto cursor-text"></div>

	<WikilinkModal
		isOpen={isWikilinkModalOpen}
		onClose={() => (isWikilinkModalOpen = false)}
		onSelect={handleWikilinkSelect}
		{availableDocuments}
	/>

	<LinkModal
		isOpen={isLinkModalOpen}
		initialUrl={linkModalInitialUrl}
		initialText={linkModalInitialText}
		isEditing={isEditingLink}
		onClose={handleCloseLinkModal}
		onSave={handleSaveLink}
		onUnlink={handleUnlink}
	/>
</div>

<style>
	:global(.tiptap p.is-editor-empty:first-child::before) {
		color: var(--text-muted);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	:global(.tiptap blockquote) {
		border-left: 3px solid #10b981;
		padding-left: 1rem;
		font-style: italic;
		color: var(--text-secondary);
	}

	:global(.tiptap pre) {
		background: var(--bg-surface-subtle);
		border: 1px solid var(--border-app);
		color: var(--text-primary);
		font-family: var(--font-mono, ui-monospace, monospace);
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}
	/* Hilangkan tanda kutip / backticks bawaan @tailwindcss/typography */
	:global(.tiptap code::before),
	:global(.tiptap code::after) {
		content: '' !important;
	}

	:global(.tiptap h1),
	:global(.tiptap h2),
	:global(.tiptap h3),
	:global(.tiptap h4),
	:global(.tiptap h5),
	:global(.tiptap h6) {
		color: var(--text-primary) !important;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	:global(.tiptap code) {
		background-color: var(--bg-surface-subtle);
		color: var(--text-primary) !important;
		border: 1px solid var(--border-app);
		padding: 0.15rem 0.35rem;
		border-radius: 0.375rem;
		font-size: 0.85em;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-weight: 500;
	}
	:global(.tiptap pre code) {
		background: transparent;
		border: none;
		color: inherit;
		padding: 0;
	}
</style>
