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
  BeginCheckoutEvent,
  UpgradeCtaClickedEvent,
} from '@/types/gtm';

/**
 * Initialize dataLayer if it doesn't exist
 */
function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer || [];
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
  ensureDataLayer();

  const event: FileConversionStartedEvent = {
    event: 'file_conversion_started',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    file_name: sanitizeFilename(file.name),
    input_encoding: inputEncoding,
  };

  window.dataLayer.push(event);
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
  ensureDataLayer();

  const event: FileConversionCompletedEvent = {
    event: 'file_conversion_completed',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    conversion_duration_ms: Math.round(conversionDurationMs),
    input_encoding: inputEncoding,
    output_encoding: outputEncoding,
  };

  window.dataLayer.push(event);
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
  ensureDataLayer();

  const event: FileConversionFailedEvent = {
    event: 'file_conversion_failed',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    error_type: errorType,
    error_message: sanitizeErrorMessage(errorMessage),
    input_encoding: inputEncoding,
  };

  window.dataLayer.push(event);
}

/**
 * Track a click on a "buy" button that hands off to Gumroad checkout.
 * Fired before navigation; measures how many visitors reach checkout,
 * which pages drive purchases, and (vs. Gumroad sales) checkout drop-off.
 *
 * @param value - Price shown to the user (USD)
 * @param itemName - Product/plan name (e.g. "lifetime")
 */
export function trackBeginCheckout(value: number, itemName: string): void {
  ensureDataLayer();

  const event: BeginCheckoutEvent = {
    event: 'begin_checkout',
    currency: 'USD',
    value,
    item_name: itemName,
    source_path: window.location.pathname,
  };

  window.dataLayer.push(event);
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
  ensureDataLayer();

  const event: UpgradeCtaClickedEvent = {
    event: 'upgrade_cta_clicked',
    cta_source: ctaSource,
    source_path: window.location.pathname,
  };

  window.dataLayer.push(event);
}
