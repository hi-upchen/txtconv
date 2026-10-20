/**
 * GA4 Tracking Helper Functions
 * Centralized analytics tracking for file conversion and checkout events.
 * Conversion runs entirely in the browser; no file-upload events exist
 * because files never leave the user's device.
 */

import type {
  FileConversionStartedEvent,
  FileConversionCompletedEvent,
  FileConversionFailedEvent,
  FileRejectedEvent,
  BeginCheckoutEvent,
  UpgradeCtaClickedEvent,
  PurchaseEvent,
  LoginMethod,
  LoginStartedEvent,
  LoginSucceededEvent,
  LoginFailedEvent,
  DataLayerKeysReset,
  TrackedEvent,
} from '@/types/gtm';

/**
 * Initialize dataLayer if it doesn't exist
 */
function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
}

/**
 * Pushes one event, then clears every key it set except "event".
 *
 * Tag Manager remembers the last value pushed for every key. One GA4 tag
 * forwards all events with the same parameter list. Without the reset,
 * a later event would inherit keys from an earlier one. For example, a
 * file conversion would carry login_method, or a login success would
 * carry the reason of the failure before it.
 */
function pushEvent(event: TrackedEvent): void {
  ensureDataLayer();
  window.dataLayer.push(event);
  const reset: DataLayerKeysReset = {};
  for (const key of Object.keys(event)) {
    if (key !== 'event') reset[key] = undefined;
  }
  window.dataLayer.push(reset);
}

/**
 * Sanitize filename for GA4 tracking
 * - Remove file paths
 * - Limit to 100 characters
 * - Remove special characters that might contain PII
 */
function sanitizeFilename(filename: string): string {
  // Remove any path information (/, \)
  const nameOnly = filename.split(/[/\\]/).pop() || filename;

  // Limit to 100 characters (GA4 best practice)
  return nameOnly.substring(0, 100);
}

/**
 * Sanitize error message for GA4 tracking
 * - Remove URLs, file paths, stack traces
 * - Limit to 100 characters
 */
function sanitizeErrorMessage(error: string): string {
  // Remove URLs
  let sanitized = error.replace(/https?:\/\/[^\s]+/g, '[URL]');

  // Remove file paths
  sanitized = sanitized.replace(/[A-Za-z]:[\\\/][^\s]+/g, '[PATH]');
  sanitized = sanitized.replace(/\/[a-z0-9_\-./]+/gi, '[PATH]');

  // Limit to 100 characters
  return sanitized.substring(0, 100);
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return extension ? `.${extension}` : '';
}

/**
 * Track file conversion started event
 */
export function trackFileConversionStarted(file: File, inputEncoding: string = 'detecting'): void {
  const event: FileConversionStartedEvent = {
    event: 'file_conversion_started',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    file_name: sanitizeFilename(file.name),
    input_encoding: inputEncoding,
  };

  pushEvent(event);
}

/**
 * Track file conversion completed event
 */
export function trackFileConversionCompleted(
  file: File,
  conversionDurationMs: number,
  inputEncoding: string,
  outputEncoding: string = 'UTF-8'
): void {
  const event: FileConversionCompletedEvent = {
    event: 'file_conversion_completed',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    conversion_duration_ms: Math.round(conversionDurationMs),
    input_encoding: inputEncoding,
    output_encoding: outputEncoding,
  };

  pushEvent(event);
}

/**
 * Track file conversion failed event
 */
export function trackFileConversionFailed(
  file: File,
  errorType: 'encoding_error' | 'processing_error' | 'timeout',
  errorMessage: string,
  inputEncoding: string = 'unknown'
): void {
  const event: FileConversionFailedEvent = {
    event: 'file_conversion_failed',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    error_type: errorType,
    error_message: sanitizeErrorMessage(errorMessage),
    input_encoding: inputEncoding,
  };

  pushEvent(event);
}

/**
 * Track a file rejected by pre-conversion validation (size limit,
 * blocked type, or empty file). The free 5MB size rejection is the
 * exact moment upgrade necessity appears, so this event makes the
 * paywall step of the funnel measurable in GA4.
 *
 * @param file - The rejected file (only size and extension are sent)
 * @param reason - Machine-readable rejection cause from the validator
 * @param upgradeAvailable - True when a larger paid plan would have
 *   accepted the file
 */
export function trackFileRejected(
  file: File,
  reason: FileRejectedEvent['reject_reason'],
  upgradeAvailable: boolean
): void {
  const event: FileRejectedEvent = {
    event: 'file_rejected',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    reject_reason: reason,
    upgrade_available: upgradeAvailable,
    source_path: window.location.pathname,
  };

  pushEvent(event);
}

/**
 * Track a click on a "buy" button that leads to our checkout page.
 * Fired before navigation. It measures how many visitors start checkout
 * and which pages drive purchases.
 *
 * @param value - Price shown to the user, in New Taiwan Dollars
 * @param itemName - Product or plan name, e.g. "lifetime"
 */
export function trackBeginCheckout(value: number, itemName: string): void {
  const event: BeginCheckoutEvent = {
    event: 'begin_checkout',
    currency: 'TWD',
    value,
    item_name: itemName,
    source_path: window.location.pathname,
  };

  pushEvent(event);
}

/**
 * Track a completed payment.
 * The completion page calls it once per order.
 *
 * @param input.transactionId - Our order number, the ECPay MerchantTradeNo
 * @param input.value - Amount paid
 * @param input.currency - ISO 4217 currency code, TWD for ECPay
 */
export function trackPurchase(input: {
  transactionId: string;
  value: number;
  currency: string;
}): void {
  const event: PurchaseEvent = {
    event: 'purchase',
    transaction_id: input.transactionId,
    value: input.value,
    currency: input.currency,
    items: [{ item_name: 'lifetime', price: input.value, quantity: 1 }],
  };

  pushEvent(event);
}

/**
 * Track a click on an in-context upgrade call-to-action (shown when a
 * free-tier limit is hit). Measures which limit actually drives
 * upgrade intent.
 *
 * @param ctaSource - Which limit surfaced the CTA
 */
export function trackUpgradeCtaClicked(
  ctaSource: 'file_size_limit' | 'dict_limit'
): void {
  const event: UpgradeCtaClickedEvent = {
    event: 'upgrade_cta_clicked',
    cta_source: ctaSource,
    source_path: window.location.pathname,
  };

  pushEvent(event);
}

const LOGIN_METHODS: readonly LoginMethod[] = ['google', 'email_code', 'magic_link'];

/** True when value is one of the three login methods we report. */
export function isLoginMethod(value: unknown): value is LoginMethod {
  return typeof value === 'string' && (LOGIN_METHODS as readonly string[]).includes(value);
}

/**
 * Track the moment a user starts a login.
 * Fires when the Google button is clicked or the email code form is sent.
 * Together with login_succeeded it gives the login completion rate.
 */
export function trackLoginStarted(method: LoginMethod, sourcePath: string): void {
  const event: LoginStartedEvent = {
    event: 'login_started',
    method,
    source_path: sourcePath,
  };

  pushEvent(event);
}

/**
 * Track a finished login.
 * Every path fires it on the next page load, from the one-shot
 * login_just_succeeded cookie. Firing it before a full-page navigation
 * could lose the hit while the page unloads.
 */
export function trackLoginSucceeded(method: LoginMethod, sourcePath: string): void {
  const event: LoginSucceededEvent = {
    event: 'login_succeeded',
    method,
    source_path: sourcePath,
  };

  pushEvent(event);
}

/**
 * Track a login that did not complete.
 * Reason is a short machine-readable code, never free text from the user.
 */
export function trackLoginFailed(method: LoginMethod, reason: string): void {
  const event: LoginFailedEvent = {
    event: 'login_failed',
    method,
    reason,
  };

  pushEvent(event);
}
