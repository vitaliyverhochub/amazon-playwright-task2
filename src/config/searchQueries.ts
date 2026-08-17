export const SUPPORTED_SEARCH_QUERIES = ['screwdriver', 'hammer'] as const;

export type SearchQuery = (typeof SUPPORTED_SEARCH_QUERIES)[number];

export function getSearchQueries(): SearchQuery[] {
  const rawValue = process.env.SEARCH_QUERIES?.trim();

  if (!rawValue) {
    return [...SUPPORTED_SEARCH_QUERIES];
  }

  const queries = rawValue
    .split(',')
    .map((query) => query.trim().toLowerCase())
    .filter(Boolean);

  const invalidQueries = queries.filter(
    (query) => !SUPPORTED_SEARCH_QUERIES.includes(query as SearchQuery),
  );

  if (invalidQueries.length > 0) {
    throw new Error(
      `Unsupported search query: ${invalidQueries.join(', ')}. ` +
        `Allowed values: ${SUPPORTED_SEARCH_QUERIES.join(', ')}.`,
    );
  }

  if (queries.length === 0) {
    throw new Error('SEARCH_QUERIES did not contain a valid query.');
  }

  return queries as SearchQuery[];
}
