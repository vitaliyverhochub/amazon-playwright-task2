import { expect, test } from '@playwright/test';
import { getSearchQueries } from '../src/config/searchQueries';
import { AddedToCartPanel } from '../src/pages/AddedToCartPanel';
import { AmazonHomePage } from '../src/pages/AmazonHomePage';
import { CartPage } from '../src/pages/CartPage';
import { SearchResultsPage } from '../src/pages/SearchResultsPage';

for (const query of getSearchQueries()) {
  test(`Optional cart validation: ${query}`, async ({ page }) => {
    const homePage = new AmazonHomePage(page);
    const searchResultsPage = new SearchResultsPage(page);
    const addedToCartPanel = new AddedToCartPanel(page);
    const cartPage = new CartPage(page);

    await homePage.open();
    await homePage.search(query);

    const product = await searchResultsPage.addSecondDirectAddToCartProduct();
    console.log(`Selected second directly addable organic product: ${product.title}`);
    console.log(`Expected product price: $${product.price.toFixed(2)}`);

    await cartPage.assertMiniCartCount(1);
    await addedToCartPanel.assertProduct(product);

    await cartPage.open();
    const subtotal = await cartPage.getSubtotal();

    expect.soft(
      subtotal,
      `Cart subtotal should equal selected product price $${product.price.toFixed(2)}`,
    ).toBeCloseTo(product.price, 2);
  });
}
