import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const JWT_SECRET = 'smasara-knowledge-vault-secret';
const DB_CONTAINER = 'smasara-workspace-db-1';

function generateJwt(userId: string): string {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({
			user_id: userId,
			exp: Math.floor(Date.now() / 1000) + 72 * 3600
		})
	).toString('base64url');
	const signature = crypto
		.createHmac('sha256', JWT_SECRET)
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

function runPsql(sql: string) {
	execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -d smasara_db -q`, {
		input: sql,
		stdio: ['pipe', 'pipe', 'pipe']
	});
}

test.describe('T-504: Publish/Unpublish + Pipeline Status Badges', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const username = `author_t504_${timestamp}`;
	const email = `author-t504-${timestamp}@test.local`;
	const token = generateJwt(userId);

	test.beforeAll(async () => {
		// Create test user, profile, workspace and membership in PostgreSQL
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${userId}', '${email}', 'hash_${timestamp}')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${userId}', '${username}', 'Author T504 Test')
			ON CONFLICT (id) DO UPDATE SET username = '${username}';

			INSERT INTO workspaces (id, name, slug, created_by)
			VALUES ('${wsId}', 'Workspace T504', 'ws-t504-${timestamp}', '${userId}');

			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ('${wsId}', '${userId}', 'OWNER');
		`);
	});

	test.afterAll(async () => {
		// Clean up fixtures
		try {
			runPsql(`DELETE FROM users WHERE id = '${userId}';`);
		} catch {
			// Ignore cleanup errors
		}
	});

	test('should manage publication lifecycle and display correct pipeline badges', async ({
		page,
		context
	}) => {
		// 1. Authenticate session by setting HTTP-only cookie jwt_smasara
		await context.addCookies([
			{
				name: 'jwt_smasara',
				value: token,
				url: 'http://localhost:5173'
			}
		]);

		// 2. Open dashboard
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// 3. Create a new document via "+ Baru" button in document sidebar
		const newDocBtn = page.getByRole('main').getByRole('button', { name: '+ Baru' });
		await expect(newDocBtn).toBeVisible();
		await newDocBtn.click();

		// Wait for editor title input to be loaded
		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toBeVisible({ timeout: 10000 });

		// Customize title
		const docTitle = `Catatan Uji T-504 ${timestamp}`;
		await titleInput.fill(docTitle);
		await page.getByRole('button', { name: 'Simpan', exact: true }).click();
		await expect(page.locator('text=Tersimpan')).toBeVisible({ timeout: 5000 });

		// 4. Verify Initial Pipeline State: "Private" Badge & "Publikasikan" Button
		const headerBadge = page.locator('div.flex.items-center.gap-3 [data-status]');
		await expect(headerBadge).toBeVisible();
		await expect(headerBadge).toHaveAttribute('data-status', 'private');
		await expect(headerBadge).toContainText('Private');

		// Check sidebar document item has "Private" badge
		const sidebarDoc = page.locator('div[role="group"]', { hasText: docTitle });
		await expect(sidebarDoc).toBeVisible();
		const sidebarBadge = sidebarDoc.locator('[data-status]');
		await expect(sidebarBadge).toHaveAttribute('data-status', 'private');

		// "Publikasikan" button is visible
		const publishBtn = page.getByRole('button', { name: 'Publikasikan' });
		await expect(publishBtn).toBeVisible();

		// 5. Execute Action: Publish Document
		await publishBtn.click();

		// 6. Verify Post-Publish Transitions
		// Status feedback toast/message
		await expect(page.locator('text=Catatan berhasil dipublikasikan!')).toBeVisible({
			timeout: 5000
		});

		// Header badge updates to Live (Publik)
		await expect(headerBadge).toHaveAttribute('data-status', 'live');
		await expect(headerBadge).toContainText('Live (Publik)');

		// Sidebar badge updates to Live (Publik)
		await expect(sidebarBadge).toHaveAttribute('data-status', 'live');

		// "Tarik Publikasi" button is now visible
		const unpublishBtn = page.getByRole('button', { name: 'Tarik Publikasi' });
		await expect(unpublishBtn).toBeVisible();

		// "Lihat Publik" link is visible and directs to user's public profile
		const publicLink = page.getByRole('link', { name: 'Lihat Publik' });
		await expect(publicLink).toBeVisible();
		const href = await publicLink.getAttribute('href');
		expect(href).toBe(`/@${username}`);

		// 7. Execute Action: Unpublish Document
		await unpublishBtn.click();

		// 8. Verify Post-Unpublish Transitions
		// Status feedback toast/message
		await expect(page.locator('text=Publikasi ditarik')).toBeVisible({ timeout: 5000 });

		// Header badge reverts to Private
		await expect(headerBadge).toHaveAttribute('data-status', 'private');
		await expect(headerBadge).toContainText('Private');

		// Sidebar badge reverts to Private
		await expect(sidebarBadge).toHaveAttribute('data-status', 'private');

		// "Publikasikan" button is visible again
		await expect(publishBtn).toBeVisible();

		// "Tarik Publikasi" and "Lihat Publik" are no longer present
		await expect(unpublishBtn).not.toBeVisible();
		await expect(publicLink).not.toBeVisible();
	});

	test('should display Shared (Draf) badge in multi-member workspace and in folder index view', async ({
		page,
		context
	}) => {
		const collabId = crypto.randomUUID();
		const collabUsername = `collab_${Date.now()}`;
		const folderId = crypto.randomUUID();
		const docId = crypto.randomUUID();
		const nowTs = Date.now();

		// Add collaborator to workspace, folder, and document
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${collabId}', '${collabUsername}@test.local', 'hash')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${collabId}', '${collabUsername}', 'Collab User')
			ON CONFLICT DO NOTHING;

			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ('${wsId}', '${collabId}', 'EDITOR')
			ON CONFLICT DO NOTHING;

			INSERT INTO folders (id, workspace_id, name)
			VALUES ('${folderId}', '${wsId}', 'Folder Kolaborasi')
			ON CONFLICT DO NOTHING;

			INSERT INTO documents (id, workspace_id, folder_id, author_id, title, content, is_public, slug)
			VALUES ('${docId}', '${wsId}', '${folderId}', '${userId}', 'Dokumen Bersama', '# Isi Bersama', false, 'dok-bersama-${nowTs}')
			ON CONFLICT DO NOTHING;
		`);

		await context.addCookies([
			{
				name: 'jwt_smasara',
				value: token,
				url: 'http://localhost:5173'
			}
		]);

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Click on "Dokumen Bersama" in sidebar
		const docItem = page.locator('div[role="group"]', { hasText: 'Dokumen Bersama' });
		await expect(docItem).toBeVisible({ timeout: 10000 });
		await docItem.click();

		// Verify that badge displays "Shared (Draf)" or "Shared"
		const headerBadge = page.locator('div.flex.items-center.gap-3 [data-status]');
		await expect(headerBadge).toBeVisible();
		await expect(headerBadge).toHaveAttribute('data-status', 'shared');
		await expect(headerBadge).toContainText('Shared');

		// Verify sidebar document item also has "Shared" badge
		const sidebarBadge = docItem.locator('[data-status]');
		await expect(sidebarBadge).toHaveAttribute('data-status', 'shared');

		// Publish it
		const publishBtn = page.getByRole('button', { name: 'Publikasikan' });
		await expect(publishBtn).toBeVisible();
		await publishBtn.click();

		// Confirm transition from Shared -> Live
		await expect(headerBadge).toHaveAttribute('data-status', 'live');
		await expect(headerBadge).toContainText('Live (Publik)');
		await expect(sidebarBadge).toHaveAttribute('data-status', 'live');

		// Unpublish it
		const unpublishBtn = page.getByRole('button', { name: 'Tarik Publikasi' });
		await expect(unpublishBtn).toBeVisible();
		await unpublishBtn.click();

		// Confirm transition from Live -> Shared
		await expect(headerBadge).toHaveAttribute('data-status', 'shared');
		await expect(sidebarBadge).toHaveAttribute('data-status', 'shared');

		// Now test FolderIndexView: click folder in left sidebar
		await page.getByRole('button', { name: 'Folder Kolaborasi', exact: true }).click();

		// Open folder README / index view
		const readmeBtn = page.getByRole('button', { name: 'README' });
		await readmeBtn.click();

		// Verify folder document card in FolderIndexView displays status badge
		const folderDocCard = page.locator('section:has-text("Daftar Catatan dalam Folder") button', {
			hasText: 'Dokumen Bersama'
		});
		await expect(folderDocCard).toBeVisible();
		const cardBadge = folderDocCard.locator('[data-status]');
		await expect(cardBadge).toBeVisible();
		await expect(cardBadge).toHaveAttribute('data-status', 'shared');
	});
});
