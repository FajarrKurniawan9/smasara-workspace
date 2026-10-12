import { test, expect } from '@playwright/test';
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

test.describe('T-801: Verifikasi Kontras Tema & Fitur Hapus Catatan', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const username = `author_${timestamp}`;
	const token = generateJwt(userId);

	const doc1 = {
		id: crypto.randomUUID(),
		workspace_id: wsId,
		folder_id: null,
		title: 'Catatan Pertama',
		slug: 'catatan-pertama',
		content: '# Catatan Pertama\n\nIsi konten pertama',
		is_public: false,
		version: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	const doc2 = {
		id: crypto.randomUUID(),
		workspace_id: wsId,
		folder_id: null,
		title: 'Catatan Kedua',
		slug: 'catatan-kedua',
		content: '# Catatan Kedua\n\nIsi konten kedua',
		is_public: false,
		version: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};

	test('1. Halaman Login memiliki teks terlihat jelas dan mendukung pemilihan tema', async ({
		page
	}) => {
		// Mock endpoint agar tidak ditendang ke dashboard jika ada cookie sisa
		await page.route('**/api/me', async (route) => {
			await route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) });
		});

		await page.goto('/login');
		await page.waitForLoadState('networkidle');

		// Judul dan link harus terlihat jelas
		const heading = page.locator('h1', { hasText: 'Masuk Smasara' });
		await expect(heading).toBeVisible();

		const registerLink = page.locator('a[href="/register"]', { hasText: 'Daftar di sini' });
		await expect(registerLink).toBeVisible();

		// Selector tema auth harus ada dan berfungsi
		const themeSelector = page.locator('[data-testid="auth-theme-selector"]');
		await expect(themeSelector).toBeVisible();

		// Coba ubah ke mode Sepia (Normal)
		const sepiaBtn = page.locator('button[aria-label="Mode Sepia Normal"]');
		await sepiaBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'normal');

		// Coba ubah ke mode Gelap (Dark)
		const darkBtn = page.locator('button[aria-label="Mode Gelap"]');
		await darkBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('html')).toHaveClass(/dark/);

		// Di mode gelap, judul dan link tetap terlihat
		await expect(heading).toBeVisible();
		await expect(registerLink).toBeVisible();

		// Coba ubah kembali ke mode Terang
		const lightBtn = page.locator('button[aria-label="Mode Terang"]');
		await lightBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	});

	test('2. Panel Rekomendasi / Catatan Terkait terlihat jelas di Dark Mode', async ({
		page,
		context
	}) => {
		const currentDocs = [doc1];

		await context.addCookies([
			{
				name: 'jwt',
				value: token,
				domain: 'localhost',
				path: '/'
			}
		]);

		await page.route('**/api/me', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ user_id: userId })
			});
		});

		await page.route('**/api/profiles/me', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: { username } })
			});
		});

		await page.route('**/api/workspaces', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					workspaces: [{ id: wsId, name: 'Workspace Uji', role: 'owner' }]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/members`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					members: [{ user_id: userId, role: 'owner', email: 'test@local' }]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/folders`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ folders: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/${doc1.id}/related`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ related: [] })
			});
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Ubah tema ke Dark mode via localStorage / script
		await page.evaluate(() => {
			localStorage.setItem('smasara_theme_mode', 'dark');
			document.documentElement.setAttribute('data-theme', 'dark');
			document.documentElement.classList.add('dark');
		});

		const relatedSection = page.locator('[data-testid="related-notes-section"]');
		await expect(relatedSection).toBeVisible();

		// Pesan empty state harus terlihat jelas
		const emptyMessage = relatedSection.locator(
			'text=Belum ada catatan yang terhubung atau mirip dengan dokumen ini.'
		);
		await expect(emptyMessage).toBeVisible();

		const tipBadge = relatedSection.locator('text=[[nama-catatan]]');
		await expect(tipBadge).toBeVisible();
	});

	test('3. Pengguna dapat menghapus catatan melalui tombol Hapus di Header Editor', async ({
		page,
		context
	}) => {
		let currentDocs = [{ ...doc1 }, { ...doc2 }];

		await context.addCookies([
			{
				name: 'jwt',
				value: token,
				domain: 'localhost',
				path: '/'
			}
		]);

		await page.route('**/api/me', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ user_id: userId })
			});
		});

		await page.route('**/api/profiles/me', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: { username } })
			});
		});

		await page.route('**/api/workspaces', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					workspaces: [{ id: wsId, name: 'Workspace Uji', role: 'owner' }]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/members`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					members: [{ user_id: userId, role: 'owner', email: 'test@local' }]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/folders`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ folders: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/${doc1.id}/related`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ related: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/${doc2.id}/related`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ related: [] })
			});
		});

		let deletedDocId: string | null = null;
		await page.route(`**/api/workspaces/${wsId}/documents/*`, async (route) => {
			if (route.request().method() === 'DELETE') {
				const url = route.request().url();
				deletedDocId = url.split('/').pop() || null;
				currentDocs = currentDocs.filter((d) => d.id !== deletedDocId);
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Dokumen berhasil dipindahkan ke Recycle Bin' })
				});
			} else {
				await route.continue();
			}
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Pastikan Catatan Pertama sedang aktif di editor
		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toHaveValue('Catatan Pertama');

		// Cari dan klik tombol Hapus di header editor
		const deleteBtn = page.locator('[data-testid="delete-document-btn"]');
		await expect(deleteBtn).toBeVisible();
		await deleteBtn.click();

		// Modal dialog konfirmasi harus muncul
		const modalTitle = page.locator('#delete-doc-modal-title');
		await expect(modalTitle).toBeVisible();
		await expect(modalTitle).toContainText('Hapus Catatan');

		// Uji tombol Batal
		const cancelBtn = page.locator('button', { hasText: 'Batal' });
		await cancelBtn.click();
		await expect(modalTitle).not.toBeVisible();

		// Klik hapus lagi dan konfirmasi
		await deleteBtn.click();
		await expect(modalTitle).toBeVisible();

		const confirmDeleteBtn = page.locator('[data-testid="confirm-delete-doc-btn"]');
		await expect(confirmDeleteBtn).toBeVisible();
		await confirmDeleteBtn.click();

		// Modal tertutup dan API terpanggil
		await expect(modalTitle).not.toBeVisible();
		expect(deletedDocId).toBe(doc1.id);

		// Otomatis berganti ke Catatan Kedua
		await expect(titleInput).toHaveValue('Catatan Kedua');

		// Catatan Pertama tidak ada lagi di sidebar
		const doc1Item = page.locator('[data-testid="document-item"]', {
			hasText: 'Catatan Pertama'
		});
		await expect(doc1Item).toHaveCount(0);
	});

	test('4. Pengguna dapat menghapus catatan melalui tombol hover di sidebar list', async ({
		page,
		context
	}) => {
		let currentDocs = [{ ...doc2 }];

		await context.addCookies([
			{
				name: 'jwt',
				value: token,
				domain: 'localhost',
				path: '/'
			}
		]);

		await page.route('**/api/me', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ user_id: userId })
			});
		});

		await page.route('**/api/profiles/me', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ profile: { username } })
			});
		});

		await page.route('**/api/workspaces', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					workspaces: [{ id: wsId, name: 'Workspace Uji', role: 'owner' }]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/members`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					members: [{ user_id: userId, role: 'owner', email: 'test@local' }]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/folders`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ folders: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/${doc2.id}/related`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ related: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/${doc2.id}`, async (route) => {
			if (route.request().method() === 'DELETE') {
				currentDocs = [];
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Dokumen berhasil dipindahkan ke Recycle Bin' })
				});
			} else {
				await route.continue();
			}
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Cari tombol hapus di item sidebar
		const sidebarDeleteBtn = page.locator('[data-testid="delete-document-item-btn"]');
		await expect(sidebarDeleteBtn).toBeAttached();
		await sidebarDeleteBtn.click({ force: true });

		// Dialog konfirmasi muncul
		const modalTitle = page.locator('#delete-doc-modal-title');
		await expect(modalTitle).toBeVisible();

		// Konfirmasi hapus
		const confirmDeleteBtn = page.locator('[data-testid="confirm-delete-doc-btn"]');
		await confirmDeleteBtn.click();
		await expect(modalTitle).not.toBeVisible();

		// Tidak ada catatan lagi di workspace -> editor menampilkan empty state
		const emptyEditor = page.locator('text=Belum ada catatan yang dipilih');
		await expect(emptyEditor).toBeVisible();
	});
});
