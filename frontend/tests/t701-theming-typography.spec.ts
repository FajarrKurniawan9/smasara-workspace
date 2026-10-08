import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const DB_CONTAINER = 'smasara-workspace-db-1';

function runPsql(sql: string) {
	try {
		execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d smasara_db -q`, {
			input: sql,
			stdio: ['pipe', 'pipe', 'pipe']
		});
	} catch (e) {
		console.warn('Docker runPsql skipped/failed:', e);
	}
}

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

test.describe('T-701: Theming & Typography Kustom', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const username = `theme_user_${timestamp}`;
	const email = `theme-${timestamp}@test.local`;
	const token = generateJwt(userId);

	test.beforeAll(async () => {
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${userId}', '${email}', 'hash_${timestamp}')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${userId}', '${username}', 'Theme Author')
			ON CONFLICT (id) DO UPDATE SET username = '${username}';

			INSERT INTO workspaces (id, name, slug, created_by)
			VALUES ('${wsId}', 'Theme WS', 'ws-theme-${timestamp}', '${userId}');

			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ('${wsId}', '${userId}', 'owner');
		`);
	});

	test.beforeEach(async ({ context, page }) => {
		await context.addCookies([
			{
				name: 'jwt',
				value: token,
				domain: 'localhost',
				path: '/'
			}
		]);

		// Mock route API me & workspaces jika backend server offline
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
					workspaces: [{ id: wsId, name: 'Theme WS', role: 'owner' }]
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
				body: JSON.stringify({ documents: [] })
			});
		});

		await page.route(`**/api/workspaces/${wsId}/members`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ members: [] })
			});
		});
	});

	test('dapat membuka modal pengaturan tema dari sidebar & header', async ({ page }) => {
		await page.goto('/');

		// Cek tombol di header
		const headerBtn = page.getByTestId('theme-settings-header-btn');
		await expect(headerBtn).toBeVisible();
		await headerBtn.click();

		// Modal harus muncul
		const modal = page.getByTestId('theme-settings-modal');
		await expect(modal).toBeVisible();

		// Tutup modal via tombol selesai
		const closeBtn = page.getByTestId('theme-settings-close-btn');
		await closeBtn.click();
		await expect(modal).not.toBeVisible();

		// Buka lagi via tombol di sidebar
		const sidebarBtn = page.getByTestId('theme-settings-sidebar-btn');
		await expect(sidebarBtn).toBeVisible();
		await sidebarBtn.click();
		await expect(modal).toBeVisible();
	});

	test('dapat mengubah mode tema (Dark, Light, Normal/Sepia) dan persisten di HTML', async ({
		page
	}) => {
		await page.goto('/');

		const headerBtn = page.getByTestId('theme-settings-header-btn');
		await headerBtn.click();

		// Klik Dark Mode
		const darkBtn = page.getByTestId('theme-btn-dark');
		await darkBtn.click();

		// Verifikasi atribut pada documentElement
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('html')).toHaveClass(/dark/);

		// Klik Normal Mode (Warm Sepia)
		const normalBtn = page.getByTestId('theme-btn-normal');
		await normalBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'normal');
		await expect(page.locator('html')).not.toHaveClass(/dark/);

		// Klik Light Mode
		const lightBtn = page.getByTestId('theme-btn-light');
		await lightBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	});

	test('dapat mengubah font editor (sans, serif, mono) dan tersimpan ke localStorage', async ({
		page
	}) => {
		await page.goto('/');

		const headerBtn = page.getByTestId('theme-settings-header-btn');
		await headerBtn.click();

		// Ganti ke font Serif
		const serifBtn = page.getByTestId('font-btn-serif');
		await serifBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-font', 'serif');

		// Ganti ke font Mono
		const monoBtn = page.getByTestId('font-btn-mono');
		await monoBtn.click();
		await expect(page.locator('html')).toHaveAttribute('data-font', 'mono');

		// Cek nilai localStorage
		const savedFont = await page.evaluate(() => localStorage.getItem('smasara_font_option'));
		expect(savedFont).toBe('mono');
	});
});
