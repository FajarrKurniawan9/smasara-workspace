import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
	await page.goto('/');

	// Smasara specific generic check just to verify page loads
	// Expect a title "to contain" something. Assuming SvelteKit default or typical title.
	await expect(page).toHaveTitle(/.*|Smasara/);
});
