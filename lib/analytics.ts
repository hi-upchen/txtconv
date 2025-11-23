/**
 * GA4 Tracking Helper Functions
 * Centralized analytics tracking for file upload and conversion events
 */

import type {
  FileUploadStartedEvent,
  FileUploadCompletedEvent,
  FileUploadFailedEvent,
  FileConversionStartedEvent,
  FileConversionCompletedEvent,
  FileConversionFailedEvent,
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
 * Track file upload started event
 */
export function trackFileUploadStarted(
  file: File,
  uploadMethod: 'drag_drop' | 'click_select'
): void {
  ensureDataLayer();

  const event: FileUploadStartedEvent = {
    event: 'file_upload_started',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    file_name: sanitizeFilename(file.name),
    upload_method: uploadMethod,
  };

  window.dataLayer.push(event);
}

/**
 * Track file upload completed event
 */
export function trackFileUploadCompleted(
  file: File,
  uploadDurationMs: number
): void {
  ensureDataLayer();

  const event: FileUploadCompletedEvent = {
    event: 'file_upload_completed',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    file_name: sanitizeFilename(file.name),
    upload_duration_ms: Math.round(uploadDurationMs),
  };

  window.dataLayer.push(event);
}

/**
 * Track file upload failed event
 */
export function trackFileUploadFailed(
  file: File,
  errorType: 'validation_error' | 'network_error' | 'size_limit' | 'type_not_allowed',
  errorMessage: string
): void {
  ensureDataLayer();

  const event: FileUploadFailedEvent = {
    event: 'file_upload_failed',
    file_size: file.size,
    file_type: getFileExtension(file.name),
    error_type: errorType,
    error_message: sanitizeErrorMessage(errorMessage),
  };

  window.dataLayer.push(event);
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
