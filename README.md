# Amazon Playwright Automation Assignment

Browser automation solution implemented with **Playwright + TypeScript** and the **Page Object Model (POM)** pattern.

The required scenario searches Amazon for `screwdriver` and `hammer`, collects non-sponsored products from the first results page, filters highly rated products, sorts them by price, logs the Top 10 cheapest matching products, validates the assignment's intentionally restrictive price range with soft assertions, and prints execution statistics.

An optional cart scenario is also included. The standard `npm test` command intentionally runs only the mandatory assignment; the cart scenario has its own command because Amazon can render several different cart side-panel variants.

## Requirements

- Node.js 22.x, 24.x, or 26.x
- npm
- Internet access to `amazon.com`

## Installation

```bash
npm install
npx playwright install chromium
```

## Run the required assignment

```bash
npm test
```

By default the required test is executed twice: once for `screwdriver` and once for `hammer`.

Run in headed mode:

```bash
npm run test:headed
```

Run only one supported query when debugging:

Linux/macOS:

```bash
SEARCH_QUERIES=screwdriver npm test
```

Windows PowerShell:

```powershell
$env:SEARCH_QUERIES="screwdriver"; npm test
```

Allowed values are only `screwdriver` and `hammer`. Multiple values can be comma-separated.

## Run the optional cart scenario

```bash
npm run test:optional
```

Run required + optional scenarios:

```bash
npm run test:all
```

Run parser unit tests:

```bash
npm run test:unit
```

## Type check

```bash
npm run typecheck
```

## HTML report

```bash
npm run report
```

Playwright traces, screenshots, and videos are retained for failed executions under `test-results/`; the HTML report is written to `playwright-report/`.

## Project structure

```text
.
├── src/
│   ├── config/
│   │   └── searchQueries.ts
│   ├── models/
│   │   └── Product.ts
│   ├── pages/
│   │   ├── AddedToCartPanel.ts
│   │   ├── AmazonHomePage.ts
│   │   ├── CartPage.ts
│   │   └── SearchResultsPage.ts
│   └── utils/
│       ├── amazonGuard.ts
│       ├── logger.ts
│       └── parsers.ts
├── tests/
│   ├── cart.spec.ts
│   └── product-search.spec.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── README.md
├── DESIGN.md
└── SUBMISSION.md
```

## Required scenario: implementation details

### 1. Search parameterization

`src/config/searchQueries.ts` defines the supported query type and reads the optional `SEARCH_QUERIES` environment variable. Without an override, both required values are executed, so the first scenario is repeated with the second query as requested.

### 2. Page Object Model

The tests do not directly operate on Amazon DOM details.

- `AmazonHomePage` opens Amazon, handles an optional cookie dialog, and performs the search.
- `SearchResultsPage` owns search-result locators, sponsored-product detection, card parsing, and direct add-to-cart selection.
- `amazonGuard.ts` provides shared CAPTCHA/Robot Check detection without coupling page objects to each other.
- `AddedToCartPanel` validates the optional post-add side panel.
- `CartPage` owns mini-cart and shopping-cart validations.

Parsing and data representation are kept outside the page objects in `utils/` and `models/`.

### 3. Stable locator strategy

The solution prioritizes Amazon attributes that describe component purpose rather than DOM position:

```text
#twotabsearchtextbox
#nav-search-submit-button
div[data-component-type="s-search-result"][data-asin]
```

Within each product card, locators are scoped to that card. This prevents one card from accidentally consuming title, price, rating, or review data from another product.

No `nth-child(...)` chains or absolute XPath expressions are used.

Because Amazon frequently A/B tests its markup, small fallback locator sets are used for rating, reviews, URL, cart panel, and cart subtotal. This is intentional defensive automation, not duplicate test logic.

### 4. Sponsored-product filtering

Every search-result card is inspected before parsing. Explicit sponsored markers are checked first. A normalized card-text check for the standalone word `Sponsored` is used as a fallback.

The browser context is configured as `en-US`, and `Accept-Language` is set to English so the sponsored marker and rating text are deterministic on `amazon.com`.

### 5. Defensive parsing

Each organic card is processed inside its own error boundary. If one card is malformed, missing a price, or changes markup, the error is logged and the loop continues.

A product used by the main algorithm requires:

- ASIN
- title
- price
- URL

Rating and review count are nullable because Amazon may legitimately show products without review metadata. Such products still participate in the first-page min/max price calculation but cannot pass the Step 5 filter.

Review parsing supports plain and compact forms such as `1,234`, `1.2K`, and `2M`.

### 6. Filtering and Top 10

The required filter is applied only after all usable non-sponsored first-page products are collected:

```text
rating >= 4.5
reviews >= 100
```

Matching products are sorted by numeric price ascending and the first 10 are selected.

The Top 10 are printed with `console.table`, including title, price, rating, review count, and URL.

### 7. Correct price-range source

The assignment's lower and upper limits are deliberately calculated from **all non-sponsored first-page cards with a readable numeric price**, before applying the rating/review filter. This is tracked separately from the richer product parsing so a missing title/URL does not silently change the page-level price boundaries:

```text
lower limit = cheapest organic first-page price * 1.10
upper limit = most expensive organic first-page price * 0.65
```

The Top 10 selected after Step 5 are then validated against those limits.

### 8. Failure-tolerant assertions

Each Top-10 product is processed independently.

The solution uses Playwright `expect.soft(...)` for the two required price checks. A soft assertion records the failure in the test result but does not immediately abort execution, so every remaining product is still validated and final statistics are still logged.

A manual log is emitted for every violated boundary to make terminal output explicit.

If fewer than 10 products meet the rating/review criteria, this is also recorded as a soft failure instead of terminating the loop early.

### 9. Statistics

After all validations, the console reports:

- total search-result cards on page 1;
- non-sponsored cards;
- sponsored cards skipped;
- successfully parsed products;
- parse failures;
- products matching rating >= 4.5 and reviews >= 100;
- Top-10 products at/below the lower assertion boundary;
- Top-10 products at/above the upper assertion boundary;
- Top-10 products inside the required range.

The assignment wording `number of products cheapest than assertion` / `more expensive than assertion` is interpreted as the number of selected Top-10 products violating the lower/upper assertion boundaries, because those are the products to which Step 8 explicitly applies.

## Waiting strategy

The implementation relies on Playwright locator auto-waiting and web-first assertions instead of fixed sleeps for the required scenario.

Examples include waiting for:

- the search box to be visible;
- navigation to the search URL;
- the first search-result card to become visible;
- the cart subtotal to become visible.

`networkidle` is intentionally not used. Amazon continuously loads advertising, analytics, recommendations, and other background resources, so network idleness is not a reliable readiness signal for this site.

The optional added-to-cart panel uses a small bounded polling loop because Amazon has multiple mutually exclusive side-panel implementations and there is no single universal locator to await.

## Amazon anti-bot protection

Amazon may return a CAPTCHA / `Robot Check`, especially from data-center IP addresses, repeated headless runs, or CI environments.

The project detects this condition and fails with an explicit diagnostic message. It intentionally does **not** attempt to bypass CAPTCHA or other anti-bot controls.

If a Robot Check appears locally, retry the scenario in headed mode:

```bash
npm run test:headed
```

This external behavior cannot be made fully deterministic from browser-test code alone.

## Optional cart scenario

The optional test searches for the query and selects the **second non-sponsored product that has a direct `Add to cart` action**. This interpretation avoids configurable products that first require choosing size/style/options.

The test then validates:

1. mini-cart counter equals `1`;
2. the visible added-to-cart panel contains the selected product name and price;
3. the cart page subtotal equals the selected product price.

The optional suite is excluded from the normal `npm test` command so changes to Amazon's optional side-sheet UI cannot reduce the stability of the mandatory assignment.

## Design trade-offs

This is intentionally a browser-only solution. Scraping Amazon through hidden APIs would make the task faster but would not demonstrate the Playwright/POM/browser-automation skills requested by the assignment.

The project also avoids over-engineering: there is no dependency-injection framework, custom test runner, or generic locator abstraction. Page objects encapsulate browser behavior; utilities encapsulate parsing; tests express the business flow.
