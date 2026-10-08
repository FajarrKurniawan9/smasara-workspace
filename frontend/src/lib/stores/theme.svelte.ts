import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'normal';
export type FontOption = 'sans' | 'serif' | 'mono';

const THEME_STORAGE_KEY = 'smasara_theme_mode';
const FONT_STORAGE_KEY = 'smasara_font_option';

class ThemeStore {
	mode = $state<ThemeMode>('light');
	font = $state<FontOption>('sans');

	constructor() {
		if (browser) {
			const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
			if (
				savedTheme &&
				(savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'normal')
			) {
				this.mode = savedTheme;
			} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
				// Default ke dark jika OS prefers dark
				this.mode = 'dark';
			}

			const savedFont = localStorage.getItem(FONT_STORAGE_KEY) as FontOption | null;
			if (savedFont && (savedFont === 'sans' || savedFont === 'serif' || savedFont === 'mono')) {
				this.font = savedFont;
			}

			this.applyToDom();
		}
	}

	setMode(newMode: ThemeMode) {
		this.mode = newMode;
		if (browser) {
			localStorage.setItem(THEME_STORAGE_KEY, newMode);
			this.applyToDom();
		}
	}

	setFont(newFont: FontOption) {
		this.font = newFont;
		if (browser) {
			localStorage.setItem(FONT_STORAGE_KEY, newFont);
			this.applyToDom();
		}
	}

	private applyToDom() {
		if (!browser) return;
		const root = document.documentElement;
		root.setAttribute('data-theme', this.mode);
		root.setAttribute('data-font', this.font);

		// Menyelaraskan class dark standar Tailwind
		if (this.mode === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}
	}
}

export const themeStore = new ThemeStore();
