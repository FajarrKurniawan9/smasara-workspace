import { test, expect } from '@playwright/test';

test('Verify navigation works', async ({ page }) => {
	await page.goto('/login');
	await expect(page).toHaveURL(/login/);
});
