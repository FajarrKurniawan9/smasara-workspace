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
			exp: Math.floor(Date.now() / 1000) + 72 * 3600
		})
	).toString('base64url');
	const signature = crypto
		.createHmac('sha256', 'smasara-knowledge-vault-secret')
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

test.describe('T-601: UI Pencarian Pintar (Command Palette)', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const username = `search_author_${timestamp}`;
	const email = `search-t601-${timestamp}@test.local`;
	const token = generateJwt(userId);

	const doc1Id = crypto.randomUUID();
	const doc2Id = crypto.randomUUID();
	const doc1Title = `Kucing Hitam ${timestamp}`;
	const doc2Title = `Anjing Putih ${timestamp}`;

	test.beforeAll(async () => {
		// Set up test user, workspace, and 2 documents.
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${userId}', '${email}', 'hash_${timestamp}')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${userId}', '${username}', 'Search Author')
			ON CONFLICT (id) DO UPDATE SET username = '${username}';

			INSERT INTO workspaces (id, name, slug, created_by)
			VALUES ('${wsId}', 'Search WS', 'ws-search-${timestamp}', '${userId}');

			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ('${wsId}', '${userId}', 'OWNER');

			INSERT INTO documents (id, workspace_id, author_id, title, content, is_public, slug)
			VALUES 
			('${doc1Id}', '${wsId}', '${userId}', '${doc1Title}', 'Konten hewan peliharaan kucing', false, 'kucing-${timestamp}'),
			('${doc2Id}', '${wsId}', '${userId}', '${doc2Title}', 'Konten hewan peliharaan anjing', false, 'anjing-${timestamp}');
		`);
	});

	test.afterAll(async () => {
		try {
			runPsql(`DELETE FROM users WHERE id = '${userId}';`);
		} catch {
			// ignore
		}
	});

	test('should open command palette, search, and navigate to document', async ({
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
		// Open modal via button or keyboard shortcut Control+K
		const searchBtn = page.getByRole('button', { name: /Cari di/i });
		await expect(searchBtn).toBeVisible();
		await searchBtn.click();

		// Modal should open
		const searchInput = page.getByPlaceholder('Cari catatan... (judul atau konten)');
		await expect(searchInput).toBeVisible();

		// Initially, it says "Mulai mengetik"
		await expect(page.locator('text=Mulai mengetik untuk mencari catatan.')).toBeVisible();

		// Test edge case: Not found / empty search results
		await searchInput.fill('xyznonexistentqwertyuiop');
		await expect(
			page.locator('text=Tidak ada catatan yang cocok dengan "xyznonexistentqwertyuiop".')
		).toBeVisible({ timeout: 5000 });
		await expect(page.locator('[role="option"]')).toHaveCount(0);

		// Test edge case: Clearing input resets to initial state
		await searchInput.fill('');
		await expect(page.locator('text=Mulai mengetik untuk mencari catatan.')).toBeVisible();
		await expect(page.locator('span').filter({ hasText: /^ESC$/ })).toBeVisible();
		// Type common term "hewan" that matches both documents
		await searchInput.fill('hewan');

		// Wait for search results (debounced)
		const options = page.locator('[role="option"]');
		await expect(options).toHaveCount(2, { timeout: 5000 });

		// By default, the first item (index 0) is selected
		await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
		await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');

		// Test keyboard navigation: ArrowDown moves selection to index 1
		await page.keyboard.press('ArrowDown');
		await expect(options.nth(0)).toHaveAttribute('aria-selected', 'false');
		await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');

		// Test keyboard navigation: ArrowUp moves selection back to index 0
		await page.keyboard.press('ArrowUp');
		await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
		await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');

		// Move back to index 1 to test selecting the second item
		await page.keyboard.press('ArrowDown');
		await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
		const secondItemTitle = (await options.nth(1).locator('.font-medium').textContent())?.trim();

		// Press Enter to select the active item
		await searchInput.press('Enter');

		// Modal should close
		await expect(searchInput).not.toBeVisible();

		// The editor should now have the second document selected
		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toHaveValue(secondItemTitle!);

		// Now test keyboard shortcut Cmd+K / Ctrl+K
		await page.keyboard.press('Control+k');
		await expect(searchInput).toBeVisible();

		// Press Escape to close
		await page.keyboard.press('Escape');
		await expect(searchInput).not.toBeVisible();

		// Test opening again via button and closing via backdrop click
		await searchBtn.click();
		await expect(searchInput).toBeVisible();
		await page
			.locator('[role="dialog"] > div[aria-hidden="true"]')
			.click({ position: { x: 10, y: 10 } });
		await expect(searchInput).not.toBeVisible();
	});
});
