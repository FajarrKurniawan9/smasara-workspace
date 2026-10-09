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

test.describe('T-702: Internal Graph View (Pemetaan Relasional Dokumen Workspace)', () => {
	const timestamp = Date.now();
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const folderId = crypto.randomUUID();
	const username = `graph_user_${timestamp}`;
	const email = `graph-${timestamp}@test.local`;
	const token = generateJwt(userId);

	const docAId = crypto.randomUUID();
	const docBId = crypto.randomUUID();
	const docATitle = `Catatan Arsitektur ${timestamp}`;
	const docBTitle = `Catatan Database ${timestamp}`;
	const docASlug = `arsitektur-${timestamp}`;
	const docBSlug = `database-${timestamp}`;

	test.beforeAll(async () => {
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${userId}', '${email}', 'hash_${timestamp}')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${userId}', '${username}', 'Graph Author')
			ON CONFLICT (id) DO UPDATE SET username = '${username}';

			INSERT INTO workspaces (id, name, slug, created_by)
			VALUES ('${wsId}', 'Graph WS', 'ws-graph-${timestamp}', '${userId}');

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
					workspaces: [
						{
							id: wsId,
							name: 'Graph WS',
							slug: `ws-graph-${timestamp}`,
							role: 'owner'
						}
					]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/folders`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					folders: [
						{
							id: folderId,
							workspace_id: wsId,
							name: 'Folder Inti',
							parent_id: null,
							index_document_id: null
						}
					]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					documents: [
						{
							id: docAId,
							workspace_id: wsId,
							folder_id: folderId,
							author_id: userId,
							title: docATitle,
							content: `Membahas sistem dan menghubungkan ke [[${docBSlug}]] untuk persistensi.`,
							is_public: false,
							slug: docASlug,
							version: 1,
							locked_by: null,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
							published_at: null,
							deleted_at: null
						},
						{
							id: docBId,
							workspace_id: wsId,
							folder_id: folderId,
							author_id: userId,
							title: docBTitle,
							content: 'Membahas skema PostgreSQL dan relasi.',
							is_public: false,
							slug: docBSlug,
							version: 1,
							locked_by: null,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
							published_at: null,
							deleted_at: null
						}
					]
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/documents/${docAId}`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					document: {
						id: docAId,
						workspace_id: wsId,
						folder_id: folderId,
						author_id: userId,
						title: docATitle,
						content: `Membahas sistem dan menghubungkan ke [[${docBSlug}]] untuk persistensi.`,
						is_public: false,
						slug: docASlug,
						version: 1,
						locked_by: null,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
						published_at: null,
						deleted_at: null
					}
				})
			});
		});

		await page.route(`**/api/workspaces/${wsId}/members`, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					members: [
						{
							workspace_id: wsId,
							user_id: userId,
							role: 'owner',
							username,
							full_name: 'Graph Author',
							email
						}
					]
				})
			});
		});
	});

	test('dapat membuka Workspace Graph View melalui tombol Graf di topbar', async ({ page }) => {
		await page.goto('/');

		const graphBtn = page.getByTestId('workspace-graph-btn');
		await expect(graphBtn).toBeVisible();
		await graphBtn.click();

		// Verifikasi kanvas Workspace Graph View terbuka
		const graphContainer = page.getByTestId('workspace-graph-view');
		await expect(graphContainer).toBeVisible();

		// Verifikasi header dan informasi relasi di graph
		await expect(page.getByText('Graf Relasi Dokumen Workspace')).toBeVisible();
		await expect(page.getByText(/Catatan • .* Tautan Wikilink/)).toBeVisible();
	});

	test('dapat melakukan penyaringan simpul graf dan menutup kembali ke editor', async ({
		page
	}) => {
		await page.goto('/');

		const graphBtn = page.getByTestId('workspace-graph-btn');
		await expect(graphBtn).toBeVisible();
		await graphBtn.click();

		const graphContainer = page.getByTestId('workspace-graph-view');
		await expect(graphContainer).toBeVisible();

		// Saring simpul via input pencarian di graf
		const searchInput = graphContainer.getByPlaceholder('Saring simpul...');
		await expect(searchInput).toBeVisible();
		await searchInput.fill('Arsitektur');

		// Tutup graph view kembali ke editor
		const closeBtn = graphContainer.getByRole('button', { name: /Tutup/i });
		await expect(closeBtn).toBeVisible();
		await closeBtn.click();

		// Kanvas graf tertutup
		await expect(graphContainer).not.toBeVisible();
	});
});
