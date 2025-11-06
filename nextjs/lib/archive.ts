import { put } from '@vercel/blob';

/**
 * Archive original file to Vercel Blob
 * Stores files with original filename (duplicates handled by addRandomSuffix)
 */
export async function archiveOriginalFile(file: File): Promise<void> {
  await put(`archive/${file.name}`, file, {
    access: 'public',
    addRandomSuffix: true, // Handles duplicate filenames automatically
  });
}
