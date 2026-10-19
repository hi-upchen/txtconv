// lib/payment/price.ts
/**
 * The lifetime price, kept in a file with no server-only imports.
 *
 * Browser components import the price from here.
 * That keeps Node's crypto module out of the browser bundle.
 * The payment config re-exports the same constant for server code.
 */

/** The one-time lifetime price in New Taiwan Dollars. The only copy on the server. */
export const PRO_LIFETIME_PRICE_TWD = 899;
