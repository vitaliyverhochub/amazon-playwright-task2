export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parsePrice(value: string): number {
  const compact = normalizeWhitespace(value).replace(/[^\d.,-]/g, '');

  if (!compact) {
    throw new Error(`Unable to parse price from "${value}".`);
  }

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastDot > lastComma) {
      normalized = compact.replace(/,/g, '');
    } else {
      normalized = compact.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma >= 0) {
    const decimalDigits = compact.length - lastComma - 1;
    normalized = decimalDigits === 2 ? compact.replace(',', '.') : compact.replace(/,/g, '');
  } else if (lastDot >= 0) {
    const decimalDigits = compact.length - lastDot - 1;
    normalized = decimalDigits === 2 ? compact : compact.replace(/\./g, '');
  }

  const price = Number.parseFloat(normalized);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Unable to parse price from "${value}".`);
  }

  return price;
}

export function parseRating(value: string): number {
  const normalized = normalizeWhitespace(value).replace(',', '.');
  const match = normalized.match(/([0-5](?:\.\d+)?)/);

  if (!match) {
    throw new Error(`Unable to parse rating from "${value}".`);
  }

  const rating = Number.parseFloat(match[1]);

  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new Error(`Rating is outside the expected 0-5 range: "${value}".`);
  }

  return rating;
}

export function parseReviewCount(value: string): number {
  const normalized = normalizeWhitespace(value)
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/,/g, '');

  const match = normalized.match(/([\d.]+)([KM]?)/);

  if (!match) {
    throw new Error(`Unable to parse review count from "${value}".`);
  }

  const amount = Number.parseFloat(match[1]);
  const multiplier = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : 1;
  const reviews = Math.round(amount * multiplier);

  if (!Number.isFinite(reviews) || reviews < 0) {
    throw new Error(`Unable to parse review count from "${value}".`);
  }

  return reviews;
}
