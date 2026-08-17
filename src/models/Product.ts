export interface Product {
  asin: string;
  title: string;
  price: number;
  rating: number | null;
  reviews: number | null;
  url: string;
}

export interface ProductCollection {
  products: Product[];
  organicPrices: number[];
  totalResultCards: number;
  organicCards: number;
  sponsoredCards: number;
  parseFailures: number;
}

export interface PriceValidationStatistics {
  belowOrEqualLowerLimit: number;
  aboveOrEqualUpperLimit: number;
  withinRange: number;
}
