import { test, expect, type Page, type Route } from '@playwright/test';
import crypto from 'node:crypto';

function generateJwt(userId: string): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			user_id: userId,
			exp: Math.floor(Date.now() / 1000) + 72 * 3600
		})
	).toString('base64url');
	const signature = crypto
		.createHmac('sha256', 'smasara-knowledge-vault-secret')
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

test.describe('T-803: Verifikasi Rich Text Link Modal & Desain Tema', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const username = `editor_${timestamp}`;
	const token = generateJwt(userId);

	const initialDoc = {
		id: crypto.randomUUID(),
		workspace_id: wsId,
		folder_id: null,
		title: 'Catatan Pengujian Tautan',
		slug: 'catatan-pengujian-tautan',
		content: '# Catatan Pengujian Tautan\n\nSilakan baca Dokumentasi Smasara untuk informasi.',
		is_public: false,
		version: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	const currentDocs = [initialDoc];

	test.beforeEach(async ({ context }) => {
		await context.addCookies([
			{
				name: 'auth_token',
				value: token,
				domain: 'localhost',
				path: '/'
			}
		]);
	});

	function setupRoutes(page: Page) {
		return Promise.all([
			page.route('**/api/me', async (route: Route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						user: { id: userId, username, email: 'editor@local' }
					})
				});
			}),
			page.route('**/api/workspaces', async (route: Route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						workspaces: [{ id: wsId, name: 'Workspace Editor', role: 'owner' }]
					})
				});
			}),
			page.route(`**/api/workspaces/${wsId}/members`, async (route: Route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						members: [{ user_id: userId, role: 'owner', email: 'editor@local' }]
					})
				});
			}),
			page.route(`**/api/workspaces/${wsId}/folders`, async (route: Route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ folders: [] })
				});
			}),
			page.route(`**/api/workspaces/${wsId}/documents`, async (route: Route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ documents: currentDocs })
				});
			}),
			page.route(
				`**/api/workspaces/${wsId}/documents/${initialDoc.id}/related`,
				async (route: Route) => {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ related: [] })
					});
				}
			),
			page.route(`**/api/workspaces/${wsId}/documents/${initialDoc.id}`, async (route: Route) => {
				if (route.request().method() === 'PUT') {
					const postData = route.request().postDataJSON();
					initialDoc.title = postData.title ?? initialDoc.title;
					initialDoc.content = postData.content ?? initialDoc.content;
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ document: initialDoc })
					});
				} else {
					await route.fulfill({
						status: 200,
						contentType: 'application/json',
						body: JSON.stringify({ document: initialDoc })
					});
				}
			})
		]);
	}

	test('1. Tombol Link membuka LinkModal bertema kustom tanpa dialog browser native', async ({
		page
	}) => {
		await setupRoutes(page);

		let promptTriggered = false;
		page.on('dialog', (dialog) => {
			promptTriggered = true;
			dialog.dismiss();
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Cari tombol Link di toolbar editor
		const linkBtn = page.locator('[data-testid="editor-link-btn"]');
		await expect(linkBtn).toBeVisible();

		// Klik tombol Link
		await linkBtn.click();

		// Pastikan modal kustom terbuka dan tidak ada dialog window.prompt native yang muncul
		expect(promptTriggered).toBe(false);
		const linkModal = page.locator('[data-testid="link-modal"]');
		await expect(linkModal).toBeVisible();
		await expect(page.locator('#link-modal-title')).toHaveText('Sisipkan Tautan');

		// Verifikasi tombol Batal menutup modal
		const cancelBtn = page.locator('[data-testid="link-modal-cancel-btn"]');
		await cancelBtn.click();
		await expect(linkModal).not.toBeVisible();

		// Buka kembali dan uji penutupan via tombol Escape
		await linkBtn.click();
		await expect(linkModal).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(linkModal).not.toBeVisible();
	});

	test('2. Menyisipkan tautan baru dengan teks kustom (collapsed cursor)', async ({ page }) => {
		await setupRoutes(page);
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Fokuskan editor Tiptap di akhir dokumen
		const editorEl = page.locator('.tiptap');
		await editorEl.click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');

		// Klik tombol Link di toolbar
		const linkBtn = page.locator('[data-testid="editor-link-btn"]');
		await linkBtn.click();

		const linkModal = page.locator('[data-testid="link-modal"]');
		await expect(linkModal).toBeVisible();

		// Isi URL dan teks tautan
		const urlInput = page.locator('[data-testid="link-modal-url-input"]');
		const textInput = page.locator('[data-testid="link-modal-text-input"]');
		await urlInput.fill('https://smasara.id');
		await textInput.fill('Situs Smasara');

		// Simpan
		const saveBtn = page.locator('[data-testid="link-modal-save-btn"]');
		await saveBtn.click();

		await expect(linkModal).not.toBeVisible();

		// Periksa bahwa tautan berhasil dirender di editor dengan href dan teks yang benar
		const insertedLink = page.locator('.tiptap a[href="https://smasara.id"]');
		await expect(insertedLink).toBeVisible();
		await expect(insertedLink).toHaveText('Situs Smasara');
	});

	test('3. Menyisipkan tautan pada teks terseleksi dan normalisasi otomatis skema URL', async ({
		page
	}) => {
		await setupRoutes(page);
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const editorEl = page.locator('.tiptap');
		await editorEl.click();

		// Seleksi kata "Dokumentasi" di dalam paragraf editor
		await page.evaluate(() => {
			const tiptap = document.querySelector('.tiptap');
			if (!tiptap) return;
			const walker = document.createTreeWalker(tiptap, NodeFilter.SHOW_TEXT);
			let node;
			while ((node = walker.nextNode())) {
				const idx = node.textContent?.indexOf('Dokumentasi') ?? -1;
				if (idx !== -1) {
					const range = document.createRange();
					range.setStart(node, idx);
					range.setEnd(node, idx + 'Dokumentasi'.length);
					const sel = window.getSelection();
					sel?.removeAllRanges();
					sel?.addRange(range);
					break;
				}
			}
		});

		// Klik tombol Link di toolbar
		const linkBtn = page.locator('[data-testid="editor-link-btn"]');
		await linkBtn.click();

		const linkModal = page.locator('[data-testid="link-modal"]');
		await expect(linkModal).toBeVisible();

		// Pastikan teks yang diseleksi terbaca di input teks tautan
		const textInput = page.locator('[data-testid="link-modal-text-input"]');
		await expect(textInput).toHaveValue('Dokumentasi');

		// Masukkan URL tanpa https:// untuk menguji normalisasi otomatis
		const urlInput = page.locator('[data-testid="link-modal-url-input"]');
		await urlInput.fill('docs.smasara.id/panduan');

		// Simpan tautan
		const saveBtn = page.locator('[data-testid="link-modal-save-btn"]');
		await saveBtn.click();

		await expect(linkModal).not.toBeVisible();

		// Pastikan link ber-href 'https://docs.smasara.id/panduan' terbentuk
		const linkedDoc = page.locator('.tiptap a[href="https://docs.smasara.id/panduan"]');
		await expect(linkedDoc).toBeVisible();
		await expect(linkedDoc).toHaveText('Dokumentasi');
	});

	test('4. Mengedit dan menghapus tautan (Unlink) via LinkModal', async ({ page }) => {
		await setupRoutes(page);
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Siapkan konten dokumen yang sudah memiliki link
		const editorEl = page.locator('.tiptap');
		await editorEl.click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');

		// Sisipkan link awal
		const linkBtn = page.locator('[data-testid="editor-link-btn"]');
		await linkBtn.click();
		await page.locator('[data-testid="link-modal-url-input"]').fill('https://lama.com');
		await page.locator('[data-testid="link-modal-text-input"]').fill('Tautan Lama');
		await page.locator('[data-testid="link-modal-save-btn"]').click();

		const targetLink = page.locator('.tiptap a[href="https://lama.com"]');
		await expect(targetLink).toBeVisible();

		// Klik pada tautan tersebut
		await targetLink.click();

		// Buka kembali LinkModal
		await linkBtn.click();

		const linkModal = page.locator('[data-testid="link-modal"]');
		await expect(linkModal).toBeVisible();
		await expect(page.locator('#link-modal-title')).toHaveText('Edit Tautan');

		// Tombol Hapus Tautan harus tersedia
		const unlinkBtn = page.locator('[data-testid="link-modal-unlink-btn"]');
		await expect(unlinkBtn).toBeVisible();

		// Klik tombol Hapus Tautan
		await unlinkBtn.click();

		await expect(linkModal).not.toBeVisible();

		// Tautan https://lama.com harus hilang, namun teks 'Tautan Lama' tetap ada
		await expect(page.locator('.tiptap a[href="https://lama.com"]')).not.toBeVisible();
		await expect(editorEl).toContainText('Tautan Lama');
	});

	test('5. Mengedit teks link dengan collapsed cursor dan mempertahankan skema URI kustom', async ({
		page
	}) => {
		await setupRoutes(page);
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const editorEl = page.locator('.tiptap');
		await editorEl.click();
		await page.keyboard.press('End');
		await page.keyboard.press('Enter');

		// Buat link awal
		const linkBtn = page.locator('[data-testid="editor-link-btn"]');
		await linkBtn.click();
		await page.locator('[data-testid="link-modal-url-input"]').fill('https://awal.com');
		await page.locator('[data-testid="link-modal-text-input"]').fill('Teks Awal');
		await page.locator('[data-testid="link-modal-save-btn"]').click();

		const initialLink = page.locator('.tiptap a[href="https://awal.com"]');
		await expect(initialLink).toBeVisible();

		// Klik tepat di link untuk menempatkan collapsed cursor tanpa blok seleksi
		await initialLink.click();

		// Buka kembali LinkModal
		await linkBtn.click();

		const linkModal = page.locator('[data-testid="link-modal"]');
		await expect(linkModal).toBeVisible();

		// Input teks harus terisi teks link saat ini ('Teks Awal')
		const textInput = page.locator('[data-testid="link-modal-text-input"]');
		await expect(textInput).toHaveValue('Teks Awal');

		// Ganti teks dan gunakan custom URI scheme seperti obsidian://
		await textInput.fill('Catatan Obsidian');
		const urlInput = page.locator('[data-testid="link-modal-url-input"]');
		await urlInput.fill('obsidian://open?vault=personal');
		await page.locator('[data-testid="link-modal-save-btn"]').click();

		await expect(linkModal).not.toBeVisible();

		// Tautan harus terupdate dengan URI skema kustom tanpa penambahan https://
		const updatedLink = page.locator('.tiptap a[href="obsidian://open?vault=personal"]');
		await expect(updatedLink).toBeVisible();
		await expect(updatedLink).toHaveText('Catatan Obsidian');
		// Pastikan teks lama tidak tersisa terpotong di editor
		await expect(editorEl).not.toContainText('Teks Awal');
	});

	test('6. Menutup WikilinkModal menggunakan tombol Escape keyboard', async ({ page }) => {
		await setupRoutes(page);
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const wikilinkBtn = page.locator('[data-testid="editor-wikilink-btn"]');
		await wikilinkBtn.click();

		const wikilinkModal = page.locator('[aria-labelledby="wikilink-modal-title"]');
		await expect(wikilinkModal).toBeVisible();

		// Tekan tombol Escape pada keyboard
		await page.keyboard.press('Escape');

		// Modal harus tertutup
		await expect(wikilinkModal).not.toBeVisible();
	});
});
