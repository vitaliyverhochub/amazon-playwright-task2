import { expect, type Page } from '@playwright/test';
import { parsePrice } from '../utils/parsers';

export class CartPage {
  constructor(private readonly page: Page) {}

  async assertMiniCartCount(expectedCount: number): Promise<void> {
    await expect(
      this.page.locator('#nav-cart-count'),
      `Mini-cart counter should be ${expectedCount}`,
    ).toHaveText(String(expectedCount));
  }

  async open(): Promise<void> {
    await Promise.all([
      this.page.waitForURL((url) => /\/cart|\/gp\/cart/.test(url.pathname)),
      this.page.locator('#nav-cart').click(),
    ]);
  }

  async getSubtotal(): Promise<number> {
    const subtotal = this.page
      .locator(
        [
          '#sc-subtotal-amount-activecart .sc-price',
          '#sc-subtotal-amount-buybox .sc-price',
          '[data-name="Subtotals"] .sc-price',
        ].join(', '),
      )
      .first();

    await expect(subtotal, 'Cart subtotal should be visible').toBeVisible();
    const text = await subtotal.innerText();
    return parsePrice(text);
  }
}
