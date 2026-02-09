import { put } from '@vercel/blob';
import { sanitizeFilename } from './filename-sanitizer';

/**
 * Archive original file to Vercel Blob
 *
 * Security Note - Access Control Limitations:
 * 1. The Vercel Blob put() API only accepts 'public' as the access value
 *    - Documentation explicitly lists only "public" as the supported value
 *    - Any attempt to use 'private' will result in a runtime error
 *
 * 2. Private blob access is NOT currently available (as of January 2025)
 *    - It's a planned feature with an RFC shared in January 2025
 *    - No ETA has been announced
 *    - GitHub issue #816 tracks this feature request
 *
 * Current Security Model:
 * - Blobs are publicly accessible via URL
 * - addRandomSuffix creates cryptographically random, hard-to-guess URLs
 * - Provides "security through obscurity" - not true access control
 * - URLs are unique and practically impossible to guess without knowledge
 *
 * For true private access, consider:
 * - Implementing edge middleware authorization
 * - Using alternative storage (S3 with IAM, etc.)
 * - Not storing sensitive/private data in Vercel Blob until private access is available
 *
 * @param file - File to archive
 */
export async function archiveOriginalFile(file: File): Promise<void> {
  const sanitizedName = sanitizeFilename(file.name);

  await put(`archive/${sanitizedName}`, file, {
    access: 'public', // Only supported value - see function documentation for details
    addRandomSuffix: true, // Generates cryptographically random URL suffix
  });
}
