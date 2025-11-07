/**
 * Sanitize filename to prevent path traversal attacks
 * Removes potentially dangerous characters and path separators
 *
 * @param filename - Original filename to sanitize
 * @returns Sanitized filename safe for storage and download
 */
export function sanitizeFilename(filename: string): string {
  // Step 1: Replace path separators and dangerous characters with underscores
  // This includes: / \ .. null bytes, control characters
  let sanitized = filename
    .replace(/\.\.\//g, '_') // Remove ../ path traversal
    .replace(/\.\.\\/g, '_') // Remove ..\ path traversal
    .replace(/\//g, '_')      // Remove forward slashes
    .replace(/\\/g, '_')      // Remove backslashes
    .replace(/\0/g, '_')      // Remove null bytes
    .replace(/[\r\n]/g, '_'); // Remove CRLF

  // Step 2: Keep only safe characters (alphanumeric, dots, hyphens, underscores, spaces)
  sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');

  // Step 3: Remove leading dots to prevent hidden files
  const withoutLeadingDots = sanitized.replace(/^\.+/, '');

  // Step 4: If filename becomes empty or only underscores, provide a fallback
  const trimmed = withoutLeadingDots.replace(/_+/g, '_').trim();
  if (!trimmed || /^_+$/.test(trimmed)) {
    return 'unnamed_file.txt';
  }

  return withoutLeadingDots;
}
