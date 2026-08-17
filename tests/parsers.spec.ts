import { expect, test } from '@playwright/test';
import { parsePrice, parseRating, parseReviewCount } from '../src/utils/parsers';

test.describe('Product parsing utilities', () => {
  test('parses US and European-style prices', () => {
    expect(parsePrice('$1,299.99')).toBeCloseTo(1299.99, 2);
    expect(parsePrice('€1.234,56')).toBeCloseTo(1234.56, 2);
    expect(parsePrice('$19.99')).toBeCloseTo(19.99, 2);
  });

  test('parses Amazon rating text', () => {
    expect(parseRating('4.7 out of 5 stars')).toBe(4.7);
    expect(parseRating('4,5 out of 5 stars')).toBe(4.5);
  });

  test('parses plain and compact review counts', () => {
    expect(parseReviewCount('1,234 ratings')).toBe(1234);
    expect(parseReviewCount('1.2K ratings')).toBe(1200);
    expect(parseReviewCount('2M reviews')).toBe(2_000_000);
  });
});
