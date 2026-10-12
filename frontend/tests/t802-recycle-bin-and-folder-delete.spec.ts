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

test.describe('T-802: Verifikasi Recycle Bin & Penghapusan Folder Cascading', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const username = `author_${timestamp}`;
	const token = generateJwt(userId);

	const activeDoc = {
		id: crypto.randomUUID(),
		workspace_id: wsId,
		folder_id: null as string | null,
		title: 'Catatan Aktif',
		slug: 'catatan-aktif',
		content: '# Catatan Aktif\n\nIsi catatan yang masih aktif.',
		is_public: false,
		version: 1,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		deleted_at: null
	};

	const trashedDoc1 = {
		id: crypto.randomUUID(),
		workspace_id: wsId,
		folder_id: null,
		title: 'Catatan Terbuang Pertama',
		slug: 'catatan-terbuang-pertama',
		content: '# Draf Sampah\n\nKonten draf lama.',
		is_public: false,
		version: 2,
		created_at: new Date(Date.now() - 3600000).toISOString(),
		updated_at: new Date(Date.now() - 1800000).toISOString(),
		deleted_at: new Date().toISOString()
	};

	const trashedDoc2 = {
		id: crypto.randomUUID(),
		workspace_id: wsId,
		folder_id: null,
		title: 'Arsip Eksperimen Lama',
		slug: 'arsip-eksperimen-lama',
		content: '# Eksperimen\n\nIde yang dibatalkan.',
		is_public: false,
		version: 1,
		created_at: new Date(Date.now() - 7200000).toISOString(),
		updated_at: new Date(Date.now() - 3600000).toISOString(),
		deleted_at: new Date().toISOString()
	};

	test.beforeEach(async ({ context, page }) => {
		await context.addCookies([
			{
				name: 'jwt',
				value: token,
				domain: 'localhost',
				path: '/'
			}
		]);

		// Mock autosave endpoint secara default agar tidak terjadi error proxy 502
		await page.route(`**/api/workspaces/${wsId}/documents/*`, async (route) => {
			if (route.request().method() === 'PUT') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ document: activeDoc })
				});
			} else {
				await route.continue();
			}
		});
	});

	test('1. Navigasi ke Recycle Bin dan menampilkan Empty State bila kosong', async ({ page }) => {
		const currentDocs = [activeDoc];
		const trashDocs: (typeof trashedDoc1)[] = [];

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
				body: JSON.stringify({ data: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/trash`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: trashDocs })
			});
		});

		await page.route(
			`**/api/workspaces/${wsId}/documents/${activeDoc.id}/related`,
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ related: [] })
				});
			}
		);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Cari dan klik tombol Recycle Bin di sidebar
		const recycleBinBtn = page.locator('[data-testid="recycle-bin-btn"]');
		await expect(recycleBinBtn).toBeVisible();
		await recycleBinBtn.click();

		// Recycle Bin View harus tampil
		const trashHeading = page.locator('h1', { hasText: 'Recycle Bin' });
		await expect(trashHeading).toBeVisible();

		// Menampilkan empty state karena trashDocs kosong
		const emptyHeading = page.locator('h2', { hasText: 'Recycle Bin Kosong' });
		await expect(emptyHeading).toBeVisible();

		// Tombol Kembali ke Editor Catatan berfungsi
		const backBtn = page.locator('button', { hasText: 'Kembali ke Editor Catatan' });
		await expect(backBtn).toBeVisible();
		await backBtn.click();

		// Viewmode kembali ke editor dokumen yang sedang aktif
		await expect(page.locator('input[placeholder="Judul Catatan..."]')).toBeVisible();
	});

	test('2. Menampilkan daftar catatan terhapus dan mendukung pencarian instan', async ({
		page
	}) => {
		const currentDocs = [activeDoc];
		const trashDocs = [trashedDoc1, trashedDoc2];

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
				body: JSON.stringify({ data: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/trash`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: trashDocs })
			});
		});

		await page.route(
			`**/api/workspaces/${wsId}/documents/${activeDoc.id}/related`,
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ related: [] })
				});
			}
		);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Buka Recycle Bin
		await page.locator('[data-testid="recycle-bin-btn"]').click();

		// Verifikasi kedua catatan terhapus tampil
		const item1 = page.locator(`[data-testid="trashed-doc-item-${trashedDoc1.id}"]`);
		const item2 = page.locator(`[data-testid="trashed-doc-item-${trashedDoc2.id}"]`);
		await expect(item1).toBeVisible();
		await expect(item2).toBeVisible();
		await expect(item1).toContainText('Catatan Terbuang Pertama');
		await expect(item2).toContainText('Arsip Eksperimen Lama');

		// Cari "Eksperimen" di kolom pencarian
		const searchInput = page.locator('input[placeholder="Cari catatan terhapus..."]');
		await searchInput.fill('Eksperimen');

		// item2 tetap terlihat, item1 tersembunyi
		await expect(item2).toBeVisible();
		await expect(item1).not.toBeVisible();

		// Bersihkan pencarian
		await searchInput.fill('');
		await expect(item1).toBeVisible();
		await expect(item2).toBeVisible();
	});

	test('3. Pengguna dapat memulihkan catatan dari Recycle Bin', async ({ page }) => {
		const currentDocs = [activeDoc];
		const trashDocs = [trashedDoc1];
		let restoreCalled = false;

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
				body: JSON.stringify({ data: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/trash`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: trashDocs })
			});
		});

		await page.route(
			`**/api/workspaces/${wsId}/documents/${trashedDoc1.id}/restore`,
			async (route) => {
				restoreCalled = true;
				const restored = { ...trashedDoc1, deleted_at: null };
				currentDocs.push(restored);
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ document: restored })
				});
			}
		);

		await page.route(
			`**/api/workspaces/${wsId}/documents/${activeDoc.id}/related`,
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ related: [] })
				});
			}
		);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Buka Recycle Bin
		await page.locator('[data-testid="recycle-bin-btn"]').click();
		const trashItem = page.locator(`[data-testid="trashed-doc-item-${trashedDoc1.id}"]`);
		await expect(trashItem).toBeVisible();

		// Klik tombol Pulihkan
		const restoreBtn = trashItem.locator('[data-testid="restore-doc-btn"]');
		await restoreBtn.click();

		// Verifikasi API restore dipanggil
		expect(restoreCalled).toBe(true);

		// Muncul toast notifikasi pemulihan
		await expect(page.locator('text=berhasil dipulihkan')).toBeVisible();

		// Item terhapus dari TrashView (dan menampilkan empty state karena hanya ada 1 doc)
		await expect(trashItem).not.toBeVisible();
		await expect(page.locator('h2', { hasText: 'Recycle Bin Kosong' })).toBeVisible();
	});

	test('4. Pengguna dapat menghapus catatan secara permanen setelah konfirmasi', async ({
		page
	}) => {
		const currentDocs = [activeDoc];
		const trashDocs = [trashedDoc2];
		let hardDeleteCalled = false;

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
				body: JSON.stringify({ data: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/trash`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: trashDocs })
			});
		});

		await page.route(
			`**/api/workspaces/${wsId}/documents/${trashedDoc2.id}/hard`,
			async (route) => {
				hardDeleteCalled = true;
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Document permanently deleted' })
				});
			}
		);

		await page.route(
			`**/api/workspaces/${wsId}/documents/${activeDoc.id}/related`,
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ related: [] })
				});
			}
		);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Buka Recycle Bin
		await page.locator('[data-testid="recycle-bin-btn"]').click();
		const trashItem = page.locator(`[data-testid="trashed-doc-item-${trashedDoc2.id}"]`);
		await expect(trashItem).toBeVisible();

		// Klik Hapus Permanen
		const hardDeleteBtn = trashItem.locator('[data-testid="hard-delete-doc-btn"]');
		await hardDeleteBtn.click();

		// Modal dialog konfirmasi tampil
		const modal = page.locator('div[role="dialog"]');
		await expect(modal).toBeVisible();
		await expect(modal).toContainText('Hapus Catatan Permanen');

		// Uji tombol Batal
		const cancelBtn = modal.locator('button', { hasText: 'Batal' });
		await cancelBtn.click();
		await expect(modal).not.toBeVisible();
		expect(hardDeleteCalled).toBe(false);

		// Buka kembali modal dan konfirmasi
		await hardDeleteBtn.click();
		await expect(modal).toBeVisible();

		const confirmBtn = page.locator('[data-testid="confirm-hard-delete-btn"]');
		await confirmBtn.click();

		// Verifikasi API terpanggil
		expect(hardDeleteCalled).toBe(true);

		// Muncul toast pemberitahuan
		await expect(page.locator('text=telah dihapus secara permanen')).toBeVisible();

		// Dokumen hilang dari Recycle Bin
		await expect(trashItem).not.toBeVisible();
		await expect(page.locator('h2', { hasText: 'Recycle Bin Kosong' })).toBeVisible();
	});

	test('5. Pengguna dapat menghapus folder dari sidebar dengan konfirmasi cascading', async ({
		page
	}) => {
		const folderId = crypto.randomUUID();
		let folders = [
			{
				id: folderId,
				workspace_id: wsId,
				name: 'Folder Proyek Alpha',
				parent_id: null,
				created_at: new Date().toISOString()
			}
		];
		let currentDocs = [
			{
				...activeDoc,
				folder_id: folderId as string | null
			}
		];
		let deleteFolderCalled = false;

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
				body: JSON.stringify({ data: folders })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/folders/${folderId}`, async (route) => {
			if (route.request().method() === 'DELETE') {
				deleteFolderCalled = true;
				folders = [];
				// Catatan dipindahkan ke Uncategorized (folder_id: null)
				currentDocs = currentDocs.map((d) => ({ ...d, folder_id: null }));
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Folder deleted successfully' })
				});
			} else {
				await route.continue();
			}
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: currentDocs })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/trash`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: [] })
			});
		});

		await page.route(
			`**/api/workspaces/${wsId}/documents/${activeDoc.id}/related`,
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ related: [] })
				});
			}
		);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Cari folder di sidebar
		const folderName = page.locator('span', { hasText: 'Folder Proyek Alpha' });
		await expect(folderName).toBeVisible();

		// Hover pada item folder agar action button muncul
		await folderName.hover();

		// Klik tombol hapus folder pada item tree
		const deleteFolderBtn = page.locator(`[data-testid="delete-folder-btn-${folderId}"]`);
		await expect(deleteFolderBtn).toBeVisible();
		await deleteFolderBtn.click();

		// Modal DeleteFolderModal muncul
		const modal = page.locator('div[role="dialog"]');
		await expect(modal).toBeVisible();
		await expect(modal).toContainText('Hapus Folder "Folder Proyek Alpha"');
		await expect(modal).toContainText('Uncategorized');

		// Klik Batal
		const cancelBtn = modal.locator('button', { hasText: 'Batal' });
		await cancelBtn.click();
		await expect(modal).not.toBeVisible();
		expect(deleteFolderCalled).toBe(false);

		// Buka kembali modal dan konfirmasi
		await folderName.hover();
		await deleteFolderBtn.click();
		await expect(modal).toBeVisible();

		const confirmDeleteBtn = page.locator('[data-testid="confirm-delete-folder-btn"]');
		await confirmDeleteBtn.click();

		// Verifikasi API terpanggil
		expect(deleteFolderCalled).toBe(true);

		// Notifikasi toast muncul
		await expect(page.locator('text=berhasil dihapus')).toBeVisible();

		// Folder hilang dari sidebar
		await expect(folderName).not.toBeVisible();
	});

	test('6. Pengguna dapat menghapus folder dari Folder Index View', async ({ page }) => {
		const folderId = crypto.randomUUID();
		let folders = [
			{
				id: folderId,
				workspace_id: wsId,
				name: 'Folder Utama',
				parent_id: null,
				index_document_id: null,
				created_at: new Date().toISOString()
			}
		];
		let deleteFolderCalled = false;

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
				body: JSON.stringify({ data: folders })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/folders/${folderId}`, async (route) => {
			if (route.request().method() === 'DELETE') {
				deleteFolderCalled = true;
				folders = [];
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ message: 'Folder deleted successfully' })
				});
			} else {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						folder: folders[0],
						index_document: null
					})
				});
			}
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: [activeDoc] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/trash`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ documents: [] })
			});
		});

		await page.route(
			`**/api/workspaces/${wsId}/documents/${activeDoc.id}/related`,
			async (route) => {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({ related: [] })
				});
			}
		);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Cari folder di sidebar
		const folderSpan = page.locator('span', { hasText: 'Folder Utama' });
		await expect(folderSpan).toBeVisible();

		// Hover agar action buttons muncul
		await folderSpan.hover();

		// Klik tombol buka indeks folder (README)
		const indexBtn = page.locator('button[aria-label="Buka indeks folder Folder Utama"]');
		await expect(indexBtn).toBeVisible();
		await indexBtn.click();

		// Sekarang berada di FolderIndexView
		const indexTitle = page.locator('h1', { hasText: 'Folder Utama' });
		await expect(indexTitle).toBeVisible();

		// Tombol 'Hapus Folder' di header FolderIndexView
		const indexDeleteBtn = page.locator('[data-testid="index-delete-folder-btn"]');
		await expect(indexDeleteBtn).toBeVisible();
		await indexDeleteBtn.click();

		// Modal DeleteFolderModal terbuka
		const modal = page.locator('div[role="dialog"]');
		await expect(modal).toBeVisible();
		await expect(modal).toContainText('Hapus Folder "Folder Utama"');

		// Konfirmasi hapus
		const confirmBtn = page.locator('[data-testid="confirm-delete-folder-btn"]');
		await confirmBtn.click();

		// Verifikasi API terpanggil
		expect(deleteFolderCalled).toBe(true);

		// Toast sukses muncul
		await expect(page.locator('text=berhasil dihapus')).toBeVisible();

		// ViewMode otomatis kembali ke document editor yang sedang aktif
		await expect(page.locator('input[placeholder="Judul Catatan..."]')).toBeVisible();
	});
});
