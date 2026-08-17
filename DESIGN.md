# Design and Requirement Traceability

This document maps the assignment requirements to the implementation and records the main engineering decisions.

## Mandatory scenario mapping

| Assignment requirement | Implementation |
|---|---|
| Open Amazon | `AmazonHomePage.open()` |
| Input query `screwdriver` / `hammer` | `SearchQuery` type and `getSearchQueries()` |
| Repeat with second query | data-driven loop in `tests/product-search.spec.ts`; defaults to both queries |
| Search | `AmazonHomePage.search()` |
| Collect first-page non-promoted products | `SearchResultsPage.collectNonSponsoredProducts()` |
| Rating >= 4.5 | filter in `product-search.spec.ts` |
| Reviews >= 100 | filter in `product-search.spec.ts` |
| Sort by price ascending | numeric `.sort((a, b) => a.price - b.price)` |
| Log Top 10 fields | `logTopProducts()` / `console.table()` |
| Lower limit = page min * 1.10 | calculated from `collection.organicPrices` |
| Upper limit = page max * 0.65 | calculated from `collection.organicPrices` |
| Validate each Top-10 product independently | per-product loop + `expect.soft()` |
| Continue after failed assertion | Playwright soft assertions |
| Continue after product processing error | per-card/per-product `try/catch` with logging |
| Final statistics | `logSearchStatistics()` |
| POM | page classes under `src/pages/` |
| Stable locators | component IDs/attributes and card-scoped locators |
| Appropriate waits | Playwright auto-waiting, `expect(...).toBeVisible()`, `waitForURL()` |

## Why min/max uses `organicPrices`

The assignment defines the range from the cheapest and most expensive **non-promoted product on the first page**, not from the filtered Top 10.

`SearchResultsPage` therefore records a numeric price as soon as an organic card's price can be read. The richer `Product` object additionally requires a title and product URL. This means a later title/URL parsing issue does not incorrectly remove an otherwise readable organic price from the page-level min/max calculation.

Products without a readable price cannot participate in a numeric price boundary and are logged as parse failures.

## Why rating and reviews are nullable

Amazon can display valid organic products without review metadata. Those products still count as organic first-page products and can affect min/max price, but they cannot satisfy the required `rating >= 4.5 && reviews >= 100` filter.

Representing these fields as `null` is more accurate than inventing `0` or rejecting the entire product.

## Why soft assertions are used

Step 8 explicitly says the price assertions are expected to fail often and that execution must continue for all remaining products.

Catching a normal hard `expect()` would allow the test to become green unless failures were re-thrown later. `expect.soft()` is a better fit: each assertion is recorded by Playwright, the loop continues, statistics are printed, and the overall test still reports failure when one or more soft assertions fail.

## Locator policy

The solution deliberately avoids absolute XPath and positional CSS selectors.

Primary examples:

- `#twotabsearchtextbox`
- `#nav-search-submit-button`
- `div[data-component-type="s-search-result"][data-asin]`

All product metadata is located **inside an individual result card**. Fallback locators are used only where Amazon is known to render multiple equivalent DOM variants.

## Waiting policy

The mandatory scenario has no arbitrary sleeps.

It relies on Playwright actionability/auto-waiting, URL waiting, and web-first visibility assertions. `networkidle` is avoided because Amazon continuously runs analytics, ads, recommendations, and lazy requests.

The optional cart side panel waits concurrently for known mutually exclusive panel variants with a bounded timeout.

## External limitations

Amazon actively changes DOM markup and can return CAPTCHA/Robot Check pages based on network reputation and automation frequency. The framework detects CAPTCHA and reports a targeted diagnostic. CAPTCHA bypass is intentionally outside the solution.

This is an important distinction: DOM resilience can be engineered; an external anti-bot decision cannot be made deterministic by test code alone.

## Optional cart interpretation

The phrase "second not configurable product" is interpreted as the second non-sponsored result that exposes a direct `Add to cart` action on the search page. Products requiring a size/style/configuration choice are skipped.

This is the closest executable interpretation of the requirement and is documented explicitly rather than hidden in implementation details.
