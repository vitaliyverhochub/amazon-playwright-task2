import { expect, type Locator, type Page } from '@playwright/test';
import type { Product, ProductCollection } from '../models/Product';
import { normalizeWhitespace, parsePrice, parseRating, parseReviewCount } from '../utils/parsers';
import { ensureAmazonIsUsable } from '../utils/amazonGuard';

export class SearchResultsPage {
  private readonly resultCards: Locator;

  constructor(private readonly page: Page) {
    this.resultCards = page.locator(
      'div[data-component-type="s-search-result"][data-asin]:not([data-asin=""])',
    );
  }

  async waitUntilLoaded(): Promise<void> {
    await ensureAmazonIsUsable(this.page);
    await expect(
      this.resultCards.first(),
      'At least one Amazon search-result card should be rendered',
    ).toBeVisible({ timeout: 20_000 });
  }

  async collectNonSponsoredProducts(): Promise<ProductCollection> {
    await this.waitUntilLoaded();

    const totalResultCards = await this.resultCards.count();
    const products: Product[] = [];
    const organicPrices: number[] = [];
    let organicCards = 0;
    let sponsoredCards = 0;
    let parseFailures = 0;

    for (let index = 0; index < totalResultCards; index += 1) {
      const card = this.resultCards.nth(index);
      const asin = (await card.getAttribute('data-asin')) ?? `index-${index}`;

      try {
        if (await this.isSponsored(card)) {
          sponsoredCards += 1;
          continue;
        }

        organicCards += 1;
        await card.scrollIntoViewIfNeeded();

        const price = await this.readPrice(card);
        organicPrices.push(price);

        const product = await this.parseProduct(card, asin, price);
        products.push(product);
      } catch (error) {
        parseFailures += 1;
        console.error(
          `[PARSE ERROR] Product card ${index + 1} (${asin}) was skipped: ${this.errorMessage(error)}`,
        );
      }
    }

    return {
      products,
      organicPrices,
      totalResultCards,
      organicCards,
      sponsoredCards,
      parseFailures,
    };
  }

  async addSecondDirectAddToCartProduct(): Promise<Product> {
    await this.waitUntilLoaded();

    const totalResultCards = await this.resultCards.count();
    const candidates: Array<{ product: Product; addButton: Locator }> = [];

    for (let index = 0; index < totalResultCards; index += 1) {
      const card = this.resultCards.nth(index);
      const asin = (await card.getAttribute('data-asin')) ?? `index-${index}`;

      try {
        if (await this.isSponsored(card)) {
          continue;
        }

        const addButton = this.directAddToCartButton(card);
        if ((await addButton.count()) === 0 || !(await addButton.first().isVisible())) {
          continue;
        }

        const price = await this.readPrice(card);
        const product = await this.parseProduct(card, asin, price);
        candidates.push({ product, addButton: addButton.first() });

        if (candidates.length === 2) {
          break;
        }
      } catch (error) {
        console.error(
          `[CART CANDIDATE ERROR] Product card ${index + 1} (${asin}) was skipped: ${this.errorMessage(error)}`,
        );
      }
    }

    if (candidates.length < 2) {
      throw new Error(
        `Expected at least two non-sponsored products with a direct "Add to cart" action, found ${candidates.length}.`,
      );
    }

    const selected = candidates[1];
    await selected.addButton.click();
    return selected.product;
  }

  private async parseProduct(card: Locator, asin: string, price: number): Promise<Product> {
    const title = await this.readTitle(card);
    const url = await this.readProductUrl(card);
    const rating = await this.readRating(card);
    const reviews = await this.readReviews(card);

    return {
      asin,
      title,
      price,
      rating,
      reviews,
      url,
    };
  }

  private async readPrice(card: Locator): Promise<number> {
    const priceText = await this.readRequiredText(
      card.locator('.a-price .a-offscreen, [data-a-color="base"] .a-offscreen').first(),
      'price',
    );

    return parsePrice(priceText);
  }

  private async isSponsored(card: Locator): Promise<boolean> {
    const explicitSponsoredMarker = card.locator(
      '[aria-label="Sponsored"], [aria-label^="Sponsored"], [data-component-type*="s-sponsored"]',
    );

    if ((await explicitSponsoredMarker.count()) > 0) {
      return true;
    }

    const cardText = normalizeWhitespace(await card.innerText().catch(() => ''));
    return /(^|\s)Sponsored(\s|$)/i.test(cardText);
  }

  private async readTitle(card: Locator): Promise<string> {
    const heading = card.locator('h2').first();
    const value = normalizeWhitespace(await heading.innerText());

    if (!value) {
      throw new Error('Product title is empty.');
    }

    return value;
  }

  private async readProductUrl(card: Locator): Promise<string> {
    const candidates = [
      card.locator('[data-cy="title-recipe"] a[href]').first(),
      card.locator('h2 a[href]').first(),
      card.locator('a[href]:has(h2)').first(),
    ];

    for (const candidate of candidates) {
      const href = await candidate.getAttribute('href').catch(() => null);
      if (href) {
        return new URL(href, 'https://www.amazon.com').toString();
      }
    }

    throw new Error('Product URL was not found.');
  }

  private async readRating(card: Locator): Promise<number | null> {
    const candidates = [
      card.locator('[aria-label*="out of 5 stars"]').first(),
      card.locator('.a-icon-star-small .a-icon-alt').first(),
      card.locator('.a-icon-star .a-icon-alt').first(),
    ];

    for (const candidate of candidates) {
      const value =
        (await candidate.getAttribute('aria-label').catch(() => null)) ??
        (await candidate.textContent().catch(() => null));

      if (!value) {
        continue;
      }

      try {
        return parseRating(value);
      } catch {
        // Try the next representation used by this Amazon page variant.
      }
    }

    return null;
  }

  private async readReviews(card: Locator): Promise<number | null> {
    const reviewLink = card
      .locator('a[href*="customerReviews"], a[href*="#customerReviews"]')
      .first();

    const accessibleLabel = await reviewLink.getAttribute('aria-label').catch(() => null);
    const linkText = await reviewLink.innerText().catch(() => '');

    for (const value of [accessibleLabel, linkText]) {
      if (!value) {
        continue;
      }

      try {
        return parseReviewCount(value);
      } catch {
        // Try a fallback locator below.
      }
    }

    const fallback = card
      .locator('[aria-label*="ratings"], [aria-label*="reviews"], .s-underline-text')
      .first();
    const fallbackValue =
      (await fallback.getAttribute('aria-label').catch(() => null)) ??
      (await fallback.textContent().catch(() => null));

    if (!fallbackValue) {
      return null;
    }

    try {
      return parseReviewCount(fallbackValue);
    } catch {
      return null;
    }
  }

  private directAddToCartButton(card: Locator): Locator {
    return card.locator(
      [
        'button[aria-label^="Add to cart"]',
        'button[name*="submit.addToCart"]',
        'input[name="submit.add-to-cart"]',
        'button:has-text("Add to cart")',
      ].join(', '),
    );
  }

  private async readRequiredText(locator: Locator, fieldName: string): Promise<string> {
    const text = normalizeWhitespace(await locator.textContent().catch(() => '') ?? '');

    if (!text) {
      throw new Error(`Product ${fieldName} was not found.`);
    }

    return text;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
