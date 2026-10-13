import { test, expect, type Page } from '@playwright/test';

// Mock setup for dashboard access
function setupDashboardRoutes(page: Page) {
    return Promise.all([
        page.route('**/api/me', async (route) => {
            await route.fulfill({ status: 200, body: JSON.stringify({ user: { id: 'test-user', username: 'test' } }) });
        }),
        page.route('**/api/workspaces', async (route) => {
            await route.fulfill({ status: 200, body: JSON.stringify({ workspaces: [{ id: 'ws1', name: 'Test Workspace', slug: 'test' }] }) });
        })
    ]);
}

test('T-CommandPalette: Verify dashboard breadcrumbs', async ({ page }) => {
    await setupDashboardRoutes(page);
    await page.goto('/');

    // Ensure dashboard is loaded
    await page.waitForLoadState('networkidle');

    // Breadcrumb verification
    const breadcrumbs = page.getByRole('banner').getByText('Test Workspace', { exact: true });
    await expect(breadcrumbs).toBeVisible();
});
