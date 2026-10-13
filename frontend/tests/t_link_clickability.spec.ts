import { test, expect, type Page, type Route } from '@playwright/test';
import crypto from 'node:crypto';

// Minimal mock setup to allow navigation to a document page
function setupRoutes(page: Page, wsId: string, docId: string) {
    return Promise.all([
        page.route('**/api/me', async (route) => {
            await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'test-user', username: 'test' } }) });
        }),
        page.route(`**/api/workspaces/${wsId}/documents/${docId}`, async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    id: docId,
                    title: 'Test Link Doc',
                    content: 'Check this link: [Google](https://google.com)',
                    workspace_id: wsId
                })
            });
        })
    ]);
}

test('T-Investigation: Verify external link clickability', async ({ page, context }) => {
    const wsId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    
    await setupRoutes(page, wsId, docId);
    
    // Attempt to navigate to the document
    await page.goto(`/documents/${docId}`);
    
    // Find the link
    const link = page.getByRole('link', { name: 'Google' });
    await expect(link).toBeVisible();
    
    // Listen for new page events
    const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        link.click(),
    ]);
    
    await newPage.waitForLoadState();
    
    // Expectation: Navigate to google (or at least check if newPage has the URL)
    await expect(newPage).toHaveURL(/google\.com/);
});
