/**
 * File validation utilities
 */

// Validation constants
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// Block common video and office file extensions
export const BLOCKED_EXTENSIONS = [
  // Video files
  '.mov', '.mp4', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v',
  // Office files
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf',
  // Other binary files
  '.exe', '.zip', '.rar', '.7z', '.tar', '.gz',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
  '.mp3', '.wav', '.flac', '.aac', '.ogg',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate uploaded file
 * @param file - File to validate
 * @returns Validation result
 */
export function validateFile(file: File): ValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check size
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  // Check file size limit
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds 25MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  // Block video and office files
  const fileName = file.name.toLowerCase();
  const isBlocked = BLOCKED_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (isBlocked) {
    return {
      valid: false,
      error: 'Please upload text files only.',
    };
  }

  return { valid: true };
}
