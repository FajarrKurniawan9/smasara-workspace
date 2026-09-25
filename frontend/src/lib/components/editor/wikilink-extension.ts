import { Mark, mergeAttributes } from '@tiptap/core';

export interface WikilinkOptions {
	HTMLAttributes: Record<string, unknown>;
	onWikilinkClick?: (slug: string) => void;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		wikilink: {
			setWikilink: (attributes: { slug: string }) => ReturnType;
			unsetWikilink: () => ReturnType;
		};
	}
}

export const Wikilink = Mark.create<WikilinkOptions>({
	name: 'wikilink',

	priority: 1000,
	inclusive: false,

	addOptions() {
		return {
			HTMLAttributes: {
				class:
					'smasara-wikilink text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1 py-0.5 rounded cursor-pointer font-medium underline transition-colors inline-flex items-center gap-0.5'
			},
			onWikilinkClick: undefined
		};
	},

	addAttributes() {
		return {
			slug: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-slug'),
				renderHTML: (attributes) => {
					if (!attributes.slug) {
						return {};
					}
					return {
						'data-slug': attributes.slug
					};
				}
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'a[data-slug]'
			},
			{
				tag: 'span[data-slug]'
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'a',
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
				href: `#wikilink-${HTMLAttributes['data-slug']}`
			}),
			0
		];
	},

	addCommands() {
		return {
			setWikilink:
				(attributes) =>
				({ chain }) => {
					return chain().setMark(this.name, attributes).setMeta('preventAutolink', true).run();
				},
			unsetWikilink:
				() =>
				({ chain }) => {
					return chain()
						.unsetMark(this.name, { extendEmptyMarkRange: true })
						.setMeta('preventAutolink', true)
						.run();
				}
		};
	}
});
