/** How long the frontend waits for yabe-api; matches the API's own 10 s query cap. */
export const API_TIMEOUT_MS = 10_000;

/** Transactions per page on the block page (the API's default). */
export const TX_PAGE_SIZE = 25;

/** How long the not-found page waits for the tip height; the page is complete without it. */
export const TIP_HINT_TIMEOUT_MS = 2_000;
