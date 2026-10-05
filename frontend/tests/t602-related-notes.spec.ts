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

test.describe('T-602: Panel Rekomendasi (Catatan Terkait)', () => {
	const timestamp = Date.now();
	const randomHex = crypto.randomBytes(4).toString('hex');
	const userId = crypto.randomUUID();
	const wsId = crypto.randomUUID();
	const folderId = crypto.randomUUID();
	const emptyFolderId = crypto.randomUUID();
	const username = `recom_author_${timestamp}`;
	const email = `recom-t602-${timestamp}@test.local`;
	const token = generateJwt(userId);

	const docSourceId = crypto.randomUUID();
	const docLinkedId = crypto.randomUUID();
	const docSiblingId = crypto.randomUUID();
	const docSimilarId = crypto.randomUUID();
	const docEmptyId = crypto.randomUUID();

	const docSourceTitle = `Catatan Sumber ${timestamp}`;
	const docLinkedTitle = `Catatan Tautan ${timestamp}`;
	const docSiblingTitle = `Catatan Sibling ${timestamp}`;
	// Catatan Belajar Sains Terpadu memiliki trigram similarity ~0.34 dengan Catatan Sumber,
	// sehingga menghasilkan bobot < 0.45 untuk klasifikasi "% Mirip"
	const docSimilarTitle = `Catatan Belajar Sains Terpadu ${timestamp}`;
	// Dokumen unik di folder berbeda tanpa kemiripan trigram dan tanpa wikilink
	const docEmptyTitle = `Zebra Kupu Jerapah ${randomHex}`;

	const docLinkedSlug = `tautan-${timestamp}`;

	test.beforeAll(async () => {
		runPsql(`
			INSERT INTO users (id, email, password_hash)
			VALUES ('${userId}', '${email}', 'hash_${timestamp}')
			ON CONFLICT DO NOTHING;

			INSERT INTO profiles (id, username, full_name)
			VALUES ('${userId}', '${username}', 'Recom Author')
			ON CONFLICT (id) DO UPDATE SET username = '${username}';

			INSERT INTO workspaces (id, name, slug, created_by)
			VALUES ('${wsId}', 'Recom WS', 'ws-recom-${timestamp}', '${userId}');

			INSERT INTO workspace_members (workspace_id, user_id, role)
			VALUES ('${wsId}', '${userId}', 'OWNER');

			INSERT INTO folders (id, workspace_id, name)
			VALUES ('${folderId}', '${wsId}', 'Folder Recom');

			INSERT INTO folders (id, workspace_id, name)
			VALUES ('${emptyFolderId}', '${wsId}', 'Folder Terisolasi');

			-- docLinked (target dari wikilink, weight = 1.0)
			INSERT INTO documents (id, workspace_id, author_id, title, content, is_public, slug)
			VALUES ('${docLinkedId}', '${wsId}', '${userId}', '${docLinkedTitle}', 'Konten target tautan', false, '${docLinkedSlug}');

			-- docSource (memiliki [[wikilink]] ke docLinkedSlug dan berada di folderId)
			INSERT INTO documents (id, workspace_id, author_id, folder_id, title, content, is_public, slug)
			VALUES ('${docSourceId}', '${wsId}', '${userId}', '${folderId}', '${docSourceTitle}', 'Ini referensi ke [[${docLinkedSlug}]]', false, 'sumber-${timestamp}');

			-- docSibling (berada di folder yang sama tanpa tautan, weight = 0.5)
			INSERT INTO documents (id, workspace_id, author_id, folder_id, title, content, is_public, slug)
			VALUES ('${docSiblingId}', '${wsId}', '${userId}', '${folderId}', '${docSiblingTitle}', 'Konten satu folder', false, 'sibling-${timestamp}');

			-- docSimilar (tidak di folder yang sama, kemiripan trigram ~0.34, weight < 0.45)
			INSERT INTO documents (id, workspace_id, author_id, title, content, is_public, slug)
			VALUES ('${docSimilarId}', '${wsId}', '${userId}', '${docSimilarTitle}', 'Konten beda folder judul mirip', false, 'similar-${timestamp}');

			-- docEmpty (dokumen terisolasi dalam folder tersendiri tanpa relasi apapun, weight = 0)
			INSERT INTO documents (id, workspace_id, author_id, folder_id, title, content, is_public, slug)
			VALUES ('${docEmptyId}', '${wsId}', '${userId}', '${emptyFolderId}', '${docEmptyTitle}', 'Konten catatan mandiri terisolasi', false, 'empty-${timestamp}');
		`);
	});

	test.afterAll(async () => {
		try {
			runPsql(`
				DELETE FROM documents WHERE workspace_id = '${wsId}';
				DELETE FROM users WHERE id = '${userId}';
			`);
		} catch {
			// ignore cleanup error
		}
	});

	test('should display related notes panel with correct weights (Tautan, Satu Folder, % Mirip) and navigate locally', async ({
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

		// Cari dokumen sumber di list dokumen
		const sourceDocItem = page.locator('[data-testid="document-item"]', {
			hasText: docSourceTitle
		});
		await expect(sourceDocItem).toBeVisible({ timeout: 10000 });
		await sourceDocItem.click();

		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toHaveValue(docSourceTitle);

		// 1. Verifikasi kemunculan panel catatan terkait
		const relatedSection = page.locator('[data-testid="related-notes-section"]');
		await expect(relatedSection).toBeVisible();

		// Verifikasi header panel dan badge counter
		await expect(relatedSection.locator('h3')).toContainText('Catatan Terkait & Rekomendasi');
		const countBadge = relatedSection.locator('span.rounded-full');
		await expect(countBadge).toHaveText('3');

		// 2. Verifikasi klasifikasi badge bobot
		// A. Badge "Tautan" untuk weight >= 0.9 (docLinked)
		const linkedNoteCard = relatedSection.locator('button', { hasText: docLinkedTitle });
		await expect(linkedNoteCard).toBeVisible({ timeout: 5000 });
		await expect(linkedNoteCard.locator('[data-testid="relation-badge"]')).toHaveText('Tautan');

		// B. Badge "Satu Folder" untuk weight >= 0.45 (docSibling)
		const siblingNoteCard = relatedSection.locator('button', { hasText: docSiblingTitle });
		await expect(siblingNoteCard).toBeVisible();
		await expect(siblingNoteCard.locator('[data-testid="relation-badge"]')).toHaveText(
			'Satu Folder'
		);

		// C. Badge "% Mirip" untuk kemiripan judul trigram (docSimilar)
		const similarNoteCard = relatedSection.locator('button', { hasText: docSimilarTitle });
		await expect(similarNoteCard).toBeVisible();
		await expect(similarNoteCard.locator('[data-testid="relation-badge"]')).toHaveText(
			/\d+%\s*Mirip/
		);

		// 3. Verifikasi navigasi klik catatan terkait (dokumen lokal)
		await siblingNoteCard.click();
		await expect(titleInput).toHaveValue(docSiblingTitle);
	});

	test('should navigate to target document via fallback API when note is not in local state', async ({
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

		// Intercept endpoint daftar dokumen agar docLinkedId tidak ada dalam state dokumen lokal frontend
		await page.route(`**/api/workspaces/${wsId}/documents`, async (route) => {
			const response = await route.fetch();
			const json = await response.json();
			if (json.documents && Array.isArray(json.documents)) {
				json.documents = json.documents.filter((d: { id: string }) => d.id !== docLinkedId);
			}
			await route.fulfill({ json });
		});

		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Buka dokumen sumber
		const sourceDocItem = page.locator('[data-testid="document-item"]', {
			hasText: docSourceTitle
		});
		await expect(sourceDocItem).toBeVisible({ timeout: 10000 });
		await sourceDocItem.click();

		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toHaveValue(docSourceTitle);

		const relatedSection = page.locator('[data-testid="related-notes-section"]');
		await expect(relatedSection).toBeVisible();

		const linkedNoteCard = relatedSection.locator('button', { hasText: docLinkedTitle });
		await expect(linkedNoteCard).toBeVisible({ timeout: 5000 });

		// Siapkan listener untuk memastikan request fallback API terpanggil saat kartu diklik
		const fallbackPromise = page.waitForResponse(
			(res) =>
				res.url().includes(`/documents/${docLinkedId}`) &&
				res.request().method() === 'GET' &&
				res.status() === 200
		);

		await linkedNoteCard.click();
		await fallbackPromise;

		// Verifikasi editor beralih ke docLinkedTitle via fallback API
		await expect(titleInput).toHaveValue(docLinkedTitle);
	});

	test('should handle edge case toggle hide and show related notes panel', async ({
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

		const sourceDocItem = page.locator('[data-testid="document-item"]', {
			hasText: docSourceTitle
		});
		await expect(sourceDocItem).toBeVisible({ timeout: 10000 });
		await sourceDocItem.click();

		const relatedSection = page.locator('[data-testid="related-notes-section"]');
		await expect(relatedSection).toBeVisible();

		const linkedNoteCard = relatedSection.locator('button', { hasText: docLinkedTitle });
		await expect(linkedNoteCard).toBeVisible({ timeout: 5000 });

		// Toggle sembunyikan
		const toggleBtn = relatedSection.locator('button[aria-label*="panel rekomendasi"]');
		await expect(toggleBtn).toBeVisible();
		await expect(toggleBtn).toContainText('Sembunyikan');
		await toggleBtn.click();

		// Panel konten tertutup
		await expect(toggleBtn).toContainText('Tampilkan');
		await expect(toggleBtn).toHaveAttribute('aria-label', 'Buka panel rekomendasi');
		await expect(linkedNoteCard).not.toBeVisible();

		// Toggle tampilkan kembali
		await toggleBtn.click();
		await expect(toggleBtn).toContainText('Sembunyikan');
		await expect(toggleBtn).toHaveAttribute('aria-label', 'Tutup panel rekomendasi');
		await expect(linkedNoteCard).toBeVisible();
	});

	test('should display empty state when document has no related notes', async ({
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

		// Buka dokumen terisolasi (tanpa relasi)
		const emptyDocItem = page.locator('[data-testid="document-item"]', {
			hasText: docEmptyTitle
		});
		await expect(emptyDocItem).toBeVisible({ timeout: 10000 });
		await emptyDocItem.click();

		const titleInput = page.locator('input[placeholder="Judul Catatan..."]');
		await expect(titleInput).toHaveValue(docEmptyTitle);

		const relatedSection = page.locator('[data-testid="related-notes-section"]');
		await expect(relatedSection).toBeVisible();

		// Verifikasi pesan empty state
		const emptyMessage = relatedSection.locator(
			'text=Belum ada catatan yang terhubung atau mirip dengan dokumen ini.'
		);
		await expect(emptyMessage).toBeVisible({ timeout: 5000 });

		const emptyTip = relatedSection.locator('text=Tip: Tautkan menggunakan');
		await expect(emptyTip).toBeVisible();

		// Pastikan tidak ada kartu catatan terkait
		await expect(relatedSection.locator('[data-testid="relation-badge"]')).toHaveCount(0);
	});
});
