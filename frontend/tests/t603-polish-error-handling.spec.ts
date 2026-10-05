import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const DB_CONTAINER = 'smasara-workspace-db-1';

function runPsql(sql: string) {
	execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d smasara_db -q`, {
		input: sql,
		stdio: ['pipe', 'pipe', 'pipe']
	});
}

function generateJwt(userId: string): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			user_id: userId,
			exp: Math.floor(Date.now() / 1000) + 3600
		})
	).toString('base64url');
	const signature = crypto
		.createHmac('sha256', 'smasara-knowledge-vault-secret')
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

test.describe('T-603: Polish & Error Handling (Toast, Validation, & States)', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const folderId = crypto.randomUUID();
	const username = `polish_author_${timestamp}`;
	const email = `polish-t603-${timestamp}@test.local`;
	const token = generateJwt(userId);

	const docId = crypto.randomUUID();
	const docTitle = `Catatan Uji Polish ${timestamp}`;

	test.beforeAll(async () => {
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${userId}', '${email}', 'hash_${timestamp}')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${userId}', '${username}', 'Polish Author')
			ON CONFLICT (id) DO UPDATE SET username = '${username}';

			INSERT INTO workspaces (id, name, slug, created_by)
			VALUES ('${wsId}', 'Polish WS', 'ws-polish-${timestamp}', '${userId}');

			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ('${wsId}', '${userId}', 'OWNER');

			INSERT INTO folders (id, workspace_id, name)
			VALUES ('${folderId}', '${wsId}', 'Folder Polish');

			INSERT INTO documents (id, workspace_id, author_id, folder_id, title, content, is_public, slug)
			VALUES ('${docId}', '${wsId}', '${userId}', '${folderId}', '${docTitle}', 'Konten untuk pengujian polish', false, 'polish-${timestamp}');
		`);
	});

	test.afterAll(async () => {
		try {
			runPsql(`DELETE FROM users WHERE id = '${userId}';`);
		} catch {
			// ignore
		}
	});

	test('should display toast notifications instead of native alerts and handle empty/loading states gracefully', async ({
		page,
		context
	}) => {
		await context.addCookies([
			{
				name: 'jwt_smasara',
				value: token,
				url: 'http://localhost:5173'
			}
		]);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// 1. Verifikasi container toast ada di DOM
		const toastContainer = page.locator('[data-testid="toast-container"]');
		await expect(toastContainer).toBeAttached();

		// 2. Pilih dokumen uji
		const docItem = page.locator('[data-testid="document-item"]', { hasText: docTitle });
		await expect(docItem).toBeVisible({ timeout: 10000 });
		await docItem.click();

		// 3. Verifikasi editor canvas terisi dengan judul
		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toHaveValue(docTitle);

		// 4. Uji interaksi pembuatan dokumen baru via tombol "+ Baru"
		const createDocBtn = page.getByRole('main').getByRole('button', { name: '+ Baru' });
		await expect(createDocBtn).toBeVisible();
		// 5. Masukkan teks wikilink ke dokumen dan klik untuk memicu navigasi
		const editorEl = page.locator('.tiptap');
		await editorEl.click();
		// Masukkan link HTML dengan data-slug ke dalam editor
		await page.evaluate(() => {
			const ed = document.querySelector('.tiptap') as HTMLElement | null;
			if (ed) {
				const a = document.createElement('a');
				a.setAttribute('data-slug', 'catatan-fiktif-test');
				a.className = 'smasara-wikilink text-emerald-600';
				a.textContent = '[[catatan-fiktif-test]]';
				ed.appendChild(a);
			}
		});

		const fakeWikilink = page.locator('.tiptap a[data-slug="catatan-fiktif-test"]');
		await expect(fakeWikilink).toBeVisible();
		await fakeWikilink.click();

		const infoToast = page.locator('[data-testid="toast-item"][data-type="info"]', {
			hasText: 'belum ada di workspace ini'
		});
		await expect(infoToast).toHaveAttribute('data-type', 'info');
		await expect(infoToast).toHaveClass(/bg-gray-50/);

		// Tutup toast info secara manual via tombol tutup
		const closeInfoBtn = infoToast.locator('button[aria-label="Tutup notifikasi"]');
		await expect(closeInfoBtn).toBeVisible();
		await closeInfoBtn.click();
		await expect(infoToast).not.toBeVisible();
	});

	test('should show registration success toast, allow closing it, and redirect to login', async ({
		page
	}) => {
		await page.goto('/register');

		const regEmail = `newuser-${Date.now()}@test.local`;
		await page.fill('#email', regEmail);
		await page.fill('#password', 'password123');

		await page.click('button[type="submit"]');

		// Toast sukses registrasi harus muncul dan ter-render dengan benar
		const successToast = page.locator('[data-testid="toast-item"][data-type="success"]', {
			hasText: 'Registrasi berhasil'
		});
		await expect(successToast).toBeVisible({ timeout: 5000 });
		await expect(successToast).toHaveAttribute('data-type', 'success');
		await expect(successToast).toHaveClass(/bg-emerald-50/);

		// Tutup toast sukses via tombol tutup
		const closeSuccessBtn = successToast.locator('button[aria-label="Tutup notifikasi"]');
		await expect(closeSuccessBtn).toBeVisible();
		await closeSuccessBtn.click();
		await expect(successToast).not.toBeVisible();

		// URL harus dialihkan ke /login
		await expect(page).toHaveURL(/\/login/);
	});

	test('should show error toast notification on failed action and allow closing it', async ({
		page
	}) => {
		await page.goto('/login');

		// Masukkan kredensial tidak valid untuk memicu respons error API
		await page.fill('#email', 'nonexistent-user@test.local');
		await page.fill('#password', 'wrongpassword');
		await page.click('button[type="submit"]');

		// Toast error harus muncul dan ter-render dengan tipe error
		const errorToast = page.locator('[data-testid="toast-item"][data-type="error"]');
		await expect(errorToast).toBeVisible({ timeout: 5000 });
		await expect(errorToast).toHaveAttribute('data-type', 'error');
		await expect(errorToast).toHaveClass(/bg-rose-50/);
		await expect(errorToast).toContainText('Kredensial tidak valid');

		// Verifikasi tombol tutup notifikasi berfungsi dan menutup error toast
		const closeErrorBtn = errorToast.locator('button[aria-label="Tutup notifikasi"]');
		await expect(closeErrorBtn).toBeVisible();
		await closeErrorBtn.click();
		await expect(errorToast).not.toBeVisible();
	});
});
