import { put } from '@vercel/blob';
import { sanitizeFilename } from './filename-sanitizer';

/**
 * Archive original file to Vercel Blob
 * Stores files with sanitized filename (duplicates handled by addRandomSuffix)
 */
export async function archiveOriginalFile(file: File): Promise<void> {
  const sanitizedName = sanitizeFilename(file.name);

  await put(`archive/${sanitizedName}`, file, {
    access: 'private' as any, // TypeScript types don't include 'private', but runtime supports it
    addRandomSuffix: true, // Handles duplicate filenames automatically
  });
}
