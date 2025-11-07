/**
 * Sanitize filename following industry best practices
 * Removes only truly dangerous characters while preserving international characters (Unicode)
 *
 * Approach: Blacklist-only (not whitelist)
 * Based on: sanitize-filename npm package (8M+ weekly downloads)
 *
 * Blocks:
 * - Control characters (0x00-0x1f, 0x80-0x9f)
 * - Path separators: / \
 * - Windows reserved: : * ? " < > |
 * - Windows reserved names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
 * - Leading/trailing dots and spaces
 *
 * Preserves:
 * - All Unicode characters (Chinese, Japanese, Korean, Arabic, emoji, etc.)
 * - Common punctuation: - _ . ( ) [ ] { } etc.
 *
 * @param filename - Original filename to sanitize
 * @returns Sanitized filename safe for cross-platform storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) {
    return 'unnamed_file.txt';
  }

  let sanitized = filename;

  // Step 1: Remove control characters (0x00-0x1f, 0x80-0x9f)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');

  // Step 2: Remove/replace reserved characters
  // Path separators and Windows reserved: / \ : * ? " < > |
  sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '');

  // Step 3: Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');

  // Step 4: Check for Windows reserved names
  // CON, PRN, AUX, NUL, COM1-9, LPT1-9 (case insensitive)
  const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  if (reservedNames.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }

  // Step 5: Truncate to 255 bytes (filesystem limit)
  if (new TextEncoder().encode(sanitized).length > 255) {
    // Truncate while preserving extension
    const lastDot = sanitized.lastIndexOf('.');
    if (lastDot > 0) {
      const name = sanitized.slice(0, lastDot);
      const ext = sanitized.slice(lastDot);
      const maxNameLength = 255 - new TextEncoder().encode(ext).length;
      const truncatedName = truncateToBytes(name, maxNameLength);
      sanitized = truncatedName + ext;
    } else {
      sanitized = truncateToBytes(sanitized, 255);
    }
  }

  // Step 6: Fallback for empty result
  if (!sanitized || sanitized.trim() === '') {
    return 'unnamed_file.txt';
  }

  return sanitized;
}

/**
 * Truncate string to specified byte length (UTF-8 aware)
 */
function truncateToBytes(str: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  if (bytes.length <= maxBytes) {
    return str;
  }

  // Binary search for correct length
  let left = 0;
  let right = str.length;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    const substr = str.slice(0, mid);
    const subBytes = encoder.encode(substr);

    if (subBytes.length <= maxBytes) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return str.slice(0, left);
}
