import { expect, type Page } from '@playwright/test';
import type { SearchQuery } from '../config/searchQueries';
import { ensureAmazonIsUsable } from '../utils/amazonGuard';

export class AmazonHomePage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await ensureAmazonIsUsable(this.page);
    await this.acceptCookiesIfPresent();
  }

  async search(query: SearchQuery): Promise<void> {
    const searchBox = this.page.locator('#twotabsearchtextbox');
    const searchButton = this.page.locator('#nav-search-submit-button');

    await expect(searchBox, 'Amazon search input should be visible').toBeVisible();
    await searchBox.fill(query);

    await Promise.all([
      this.page.waitForURL((url) => url.pathname === '/s' || url.searchParams.has('k')),
      searchButton.click(),
    ]);

    await ensureAmazonIsUsable(this.page);
  }

  private async acceptCookiesIfPresent(): Promise<void> {
    const candidates = [
      this.page.locator('#sp-cc-accept'),
      this.page.getByRole('button', { name: /accept.*cookies/i }),
      this.page.getByRole('button', { name: /accept all/i }),
    ];

    for (const candidate of candidates) {
      try {
        if (await candidate.first().isVisible()) {
          await candidate.first().click();
          return;
        }
      } catch {
        // Cookie consent is regional and optional. Failure to dismiss it is not fatal.
      }
    }
  }
}
