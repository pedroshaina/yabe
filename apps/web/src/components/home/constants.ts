// Plain (non-"use client") module: a constant exported from a client module reaches server
// components as a client reference, not as its value.

/** Blocks per page on the home timeline (first page, older pages, new blocks). */
export const PAGE_SIZE = 10;
