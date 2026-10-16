import { test } from '@playwright/test';

test('Verify page content', async ({ page }) => {
	await page.goto('/login');
	const content = await page.content();
	console.log(content);
});
