import type { Page } from '@playwright/test';

export async function ensureAmazonIsUsable(page: Page): Promise<void> {
  const captcha = page.locator(
    'form[action*="validateCaptcha"], #captchacharacters, img[src*="captcha"]',
  );
  const robotTitle = await page.title().catch(() => '');

  if ((await captcha.first().isVisible().catch(() => false)) || /robot check/i.test(robotTitle)) {
    throw new Error(
      'Amazon bot protection / CAPTCHA was triggered. ' +
        'Retry in headed mode or from a different network; CAPTCHA bypass is intentionally not automated.',
    );
  }
}
