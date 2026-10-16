import { test } from '@playwright/test';

test('Verify document page navigation', async ({ page }) => {
	// Navigate and check if we are redirected to auth or if the document loads
	const response = await page.goto('/documents/dummy');
	console.log('Status:', response?.status());
	console.log('URL:', page.url());
	const content = await page.content();
	console.log('Content snippet:', content.substring(0, 500));
});
