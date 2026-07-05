/**
 * File validation utilities. Size limits are license-tier aware so the
 * enforced limits match the advertised pricing (Free 5MB / Pro 100MB);
 * validation runs client-side before conversion starts.
 */

import type { LicenseType } from '@/types/user';

// Size limit per license tier, matching the published pricing plans.
export const FREE_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const PRO_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Returns the maximum allowed file size in bytes for a license tier.
 *
 * @param licenseType - User's license tier; guests count as 'free'
 * @returns Size limit in bytes (5MB free, 100MB monthly/lifetime)
 */
export function getMaxFileSize(licenseType: LicenseType = 'free'): number {
  return licenseType === 'lifetime' || licenseType === 'monthly'
    ? PRO_MAX_FILE_SIZE
    : FREE_MAX_FILE_SIZE;
}

// Kindle e-book formats we cannot open in the browser. They are proprietary
// (not ZIP-based like EPUB), so we reject them with guidance to convert to
// EPUB first rather than a generic "text files only" message.
export const KINDLE_EXTENSIONS = ['.mobi', '.azw', '.azw3'];

// Block common video, office and non-EPUB binary file extensions. EPUB is
// intentionally NOT blocked: it is a ZIP of UTF-8 text that we convert
// in-browser (see lib/epub-converter.ts). Kindle formats are handled
// separately via KINDLE_EXTENSIONS so they get a Calibre-conversion hint.
export const BLOCKED_EXTENSIONS = [
  // Video files
  '.mov', '.mp4', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v',
  // Office files
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf',
  '.pages', '.numbers', '.key', // Mac iWork
  // Other binary files
  '.exe', '.zip', '.rar', '.7z', '.tar', '.gz',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
  '.mp3', '.wav', '.flac', '.aac', '.ogg',
];

/**
 * Machine-readable rejection cause, used for analytics (`file_rejected`
 * dataLayer event). 'size_limit_free' means the free 5MB limit was hit
 * but a Pro plan would accept the file; 'size_limit_pro' means the file
 * exceeds the 100MB hard ceiling of every plan.
 */
export type FileRejectReason =
  | 'size_limit_free'
  | 'size_limit_pro'
  | 'blocked_type'
  | 'empty';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Machine-readable rejection cause; set on every rejection of a real file. */
  reason?: FileRejectReason;
  /**
   * Set when the file was rejected only because of the free-tier size
   * limit; lets the UI show an upgrade call-to-action instead of a
   * plain error.
   */
  upgradeAvailable?: boolean;
}

/**
 * Validate uploaded file against format rules and the size limit of
 * the user's license tier.
 *
 * @param file - File to validate
 * @param licenseType - User's license tier; guests count as 'free'
 * @returns Validation result; `upgradeAvailable` is true when a larger
 *   plan would have accepted the file, and `reason` carries the
 *   machine-readable rejection cause for analytics
 */
export function validateFile(file: File, licenseType: LicenseType = 'free'): ValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check size
  if (file.size === 0) {
    return { valid: false, error: 'File is empty', reason: 'empty' };
  }

  // Check file size limit for the user's tier
  const maxSize = getMaxFileSize(licenseType);
  if (file.size > maxSize) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const isFreeTier = maxSize === FREE_MAX_FILE_SIZE;
    return isFreeTier && file.size <= PRO_MAX_FILE_SIZE
      ? {
          valid: false,
          error: `檔案 ${sizeMB}MB 超過免費版 5MB 上限`,
          reason: 'size_limit_free',
          upgradeAvailable: true,
        }
      : {
          valid: false,
          error: `檔案 ${sizeMB}MB 超過 ${isFreeTier ? '5' : '100'}MB 上限`,
          reason: 'size_limit_pro',
        };
  }

  // Kindle e-book formats: not openable in-browser. Reuse the blocked_type
  // reason (keeps the analytics union stable) but with a message telling the
  // user to convert to EPUB with Calibre first, since EPUB IS supported.
  const fileName = file.name.toLowerCase();
  const isKindle = KINDLE_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (isKindle) {
    return {
      valid: false,
      error: '暫不支援 mobi/azw 格式，請先用 Calibre 轉成 EPUB 再上傳。',
      reason: 'blocked_type',
    };
  }

  // Block video, office and other binary files.
  const isBlocked = BLOCKED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (isBlocked) {
    return {
      valid: false,
      error: 'Please upload text files only.',
      reason: 'blocked_type',
    };
  }

  return { valid: true };
}
