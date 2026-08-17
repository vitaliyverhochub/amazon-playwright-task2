import { expect, test } from '@playwright/test';
import { getSearchQueries } from '../src/config/searchQueries';
import type { PriceValidationStatistics, Product } from '../src/models/Product';
import { AmazonHomePage } from '../src/pages/AmazonHomePage';
import { SearchResultsPage } from '../src/pages/SearchResultsPage';
import { logSearchStatistics, logTopProducts } from '../src/utils/logger';

const MIN_RATING = 4.5;
const MIN_REVIEWS = 100;
const TOP_PRODUCT_COUNT = 10;
const LOWER_PRICE_MULTIPLIER = 1.1;
const UPPER_PRICE_MULTIPLIER = 0.65;

for (const query of getSearchQueries()) {
  test(`Top 10 cheapest highly rated non-sponsored products: ${query}`, async ({ page }) => {
    const homePage = new AmazonHomePage(page);
    const searchResultsPage = new SearchResultsPage(page);

    await test.step('Open Amazon and search for the requested product', async () => {
      await homePage.open();
      await homePage.search(query);
      await searchResultsPage.waitUntilLoaded();
    });

    const collection = await test.step('Collect non-sponsored products from page 1', async () => {
      return searchResultsPage.collectNonSponsoredProducts();
    });

    expect(
      collection.organicPrices.length,
      'At least one non-sponsored product with a readable price is required',
    ).toBeGreaterThan(0);

    expect(
      collection.products.length,
      'At least one non-sponsored product with readable title, price and URL is required',
    ).toBeGreaterThan(0);

    const cheapestOrganicPrice = Math.min(...collection.organicPrices);
    const mostExpensiveOrganicPrice = Math.max(...collection.organicPrices);
    const lowerPriceLimit = cheapestOrganicPrice * LOWER_PRICE_MULTIPLIER;
    const upperPriceLimit = mostExpensiveOrganicPrice * UPPER_PRICE_MULTIPLIER;

    console.log(`Cheapest non-sponsored price: $${cheapestOrganicPrice.toFixed(2)}`);
    console.log(`Most expensive non-sponsored price: $${mostExpensiveOrganicPrice.toFixed(2)}`);
    console.log(`Lower assertion limit (min * 1.10): $${lowerPriceLimit.toFixed(2)}`);
    console.log(`Upper assertion limit (max * 0.65): $${upperPriceLimit.toFixed(2)}`);

    if (lowerPriceLimit >= upperPriceLimit) {
      console.warn(
        '[RANGE WARNING] Lower price limit is greater than or equal to upper price limit. ' +
          'The assignment intentionally allows price assertions to fail frequently.',
      );
    }

    const matchingProducts = collection.products
      .filter(
        (product): product is Product & { rating: number; reviews: number } =>
          product.rating !== null &&
          product.rating >= MIN_RATING &&
          product.reviews !== null &&
          product.reviews >= MIN_REVIEWS,
      )
      .sort((left, right) => left.price - right.price);

    const topProducts = matchingProducts.slice(0, TOP_PRODUCT_COUNT);

    logTopProducts(query, topProducts);

    expect.soft(
      topProducts.length,
      `Expected ${TOP_PRODUCT_COUNT} products after filtering. ` +
        `Amazon returned only ${topProducts.length} matching products on page 1.`,
    ).toBe(TOP_PRODUCT_COUNT);

    const validationStatistics: PriceValidationStatistics = {
      belowOrEqualLowerLimit: 0,
      aboveOrEqualUpperLimit: 0,
      withinRange: 0,
    };

    await test.step('Soft-validate each selected product independently', async () => {
      for (const [index, product] of topProducts.entries()) {
        try {
          const violatesLowerLimit = product.price <= lowerPriceLimit;
          const violatesUpperLimit = product.price >= upperPriceLimit;

          if (violatesLowerLimit) {
            validationStatistics.belowOrEqualLowerLimit += 1;
            console.error(
              `[FAILED LOWER LIMIT] #${index + 1} ${product.title}: ` +
                `$${product.price.toFixed(2)} must be > $${lowerPriceLimit.toFixed(2)}`,
            );
          }

          if (violatesUpperLimit) {
            validationStatistics.aboveOrEqualUpperLimit += 1;
            console.error(
              `[FAILED UPPER LIMIT] #${index + 1} ${product.title}: ` +
                `$${product.price.toFixed(2)} must be < $${upperPriceLimit.toFixed(2)}`,
            );
          }

          if (!violatesLowerLimit && !violatesUpperLimit) {
            validationStatistics.withinRange += 1;
            console.log(
              `[PASSED PRICE RANGE] #${index + 1} ${product.title}: $${product.price.toFixed(2)}`,
            );
          }

          expect.soft(
            product.price,
            `Product #${index + 1} (${product.asin}) price must be greater than ` +
              `$${lowerPriceLimit.toFixed(2)}. URL: ${product.url}`,
          ).toBeGreaterThan(lowerPriceLimit);

          expect.soft(
            product.price,
            `Product #${index + 1} (${product.asin}) price must be lower than ` +
              `$${upperPriceLimit.toFixed(2)}. URL: ${product.url}`,
          ).toBeLessThan(upperPriceLimit);
        } catch (error) {
          const message =
            `[VALIDATION ERROR] #${index + 1} ${product.title}: ` +
            `${error instanceof Error ? error.message : String(error)}`;
          console.error(message);
          expect.soft(false, message).toBeTruthy();
        }
      }
    });

    logSearchStatistics(query, collection, matchingProducts.length, validationStatistics);
  });
}
