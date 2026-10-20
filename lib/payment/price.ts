// lib/payment/price.ts
/**
 * The lifetime price and its purchase copy, kept in a file with no server-only imports.
 *
 * Browser components import the price from here.
 * That keeps Node's crypto module out of the browser bundle.
 * The payment config re-exports the same constant for server code.
 */

/**
 * The one-time lifetime price in New Taiwan Dollars.
 *
 * It is the single source for code that shows or charges the price.
 */
export const PRO_LIFETIME_PRICE_TWD = 899;

/** The lifetime price as buyers see it, for example "NT$899". */
export const PRO_PRICE_LABEL = `NT$${PRO_LIFETIME_PRICE_TWD}`;

/** The refund promise shown next to every buy button. */
export const REFUND_NOTE = '購買後 14 天內不滿意可退款';

/** Our own checkout page. Every buy button links here. */
export const CHECKOUT_PATH = '/checkout';
