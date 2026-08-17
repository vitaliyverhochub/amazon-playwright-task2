import { expect, type Locator, type Page } from '@playwright/test';
import type { Product } from '../models/Product';
import { normalizeWhitespace, parsePrice } from '../utils/parsers';

export class AddedToCartPanel {
  constructor(private readonly page: Page) {}

  async waitUntilVisible(): Promise<Locator> {
    const candidates = [
      this.page.locator('#nav-flyout-ewc'),
      this.page.locator('#attach-desktop-sideSheet'),
      this.page.locator('#sw-atc-details-single-container'),
      this.page.locator('[data-testid="add-to-cart-success"]'),
    ];

    try {
      return await Promise.any(
        candidates.map(async (candidate) => {
          await candidate.first().waitFor({ state: 'visible', timeout: 5_000 });
          return candidate.first();
        }),
      );
    } catch {
      throw new Error('Amazon added-to-cart side panel did not become visible.');
    }
  }

  async assertProduct(product: Product): Promise<void> {
    const panel = await this.waitUntilVisible();
    const panelText = normalizeWhitespace(await panel.innerText());
    const normalizedPanelText = panelText.toLowerCase();
    const normalizedTitle = normalizeWhitespace(product.title).toLowerCase();

    expect.soft(
      normalizedPanelText,
      'Added-to-cart panel should contain the selected product title',
    ).toContain(normalizedTitle);

    const priceCandidates = panel.locator('.a-price .a-offscreen, .a-price-whole, .a-color-price');
    const count = await priceCandidates.count();
    const panelPrices: number[] = [];

    for (let index = 0; index < count; index += 1) {
      const text = await priceCandidates.nth(index).textContent().catch(() => null);
      if (!text) {
        continue;
      }

      try {
        panelPrices.push(parsePrice(text));
      } catch {
        // Ignore non-price text matched by a fallback Amazon class.
      }
    }

    expect.soft(
      panelPrices.some((price) => Math.abs(price - product.price) < 0.01),
      `Added-to-cart panel should contain product price ${product.price.toFixed(2)}; ` +
        `observed prices: ${panelPrices.join(', ') || 'none'}`,
    ).toBeTruthy();
  }
}
