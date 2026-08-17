import type { Product, ProductCollection, PriceValidationStatistics } from '../models/Product';

export function logTopProducts(query: string, products: Product[]): void {
  console.log(`\nTop ${products.length} cheapest qualifying products for "${query}":`);
  console.table(
    products.map((product, index) => ({
      '#': index + 1,
      Title: product.title,
      Price: product.price.toFixed(2),
      Rating: product.rating?.toFixed(1) ?? 'N/A',
      Reviews: product.reviews ?? 'N/A',
      URL: product.url,
    })),
  );
}

export function logSearchStatistics(
  query: string,
  collection: ProductCollection,
  matchingProducts: number,
  validation: PriceValidationStatistics,
): void {
  console.log(`\nSearch statistics for "${query}"`);
  console.log('------------------------------------------------------------');
  console.log(`Result cards on first page:              ${collection.totalResultCards}`);
  console.log(`Non-sponsored result cards:              ${collection.organicCards}`);
  console.log(`Sponsored result cards skipped:          ${collection.sponsoredCards}`);
  console.log(`Organic cards with readable price:       ${collection.organicPrices.length}`);
  console.log(`Products successfully parsed:            ${collection.products.length}`);
  console.log(`Cards skipped because parsing failed:    ${collection.parseFailures}`);
  console.log(`Products matching rating/review filter:  ${matchingProducts}`);
  console.log(`Top products <= lower price limit:       ${validation.belowOrEqualLowerLimit}`);
  console.log(`Top products >= upper price limit:       ${validation.aboveOrEqualUpperLimit}`);
  console.log(`Top products inside assertion range:     ${validation.withinRange}`);
  console.log('------------------------------------------------------------\n');
}
