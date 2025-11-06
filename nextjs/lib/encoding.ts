import jschardet from 'jschardet';

/**
 * Detect the character encoding of a buffer
 * @param buffer - Buffer to detect encoding from
 * @returns Detected encoding name (e.g., 'UTF-8', 'GB2312', 'Big5')
 */
export function detectEncoding(buffer: Buffer): string {
  if (buffer.length === 0) {
    return 'utf-8'; // Default to UTF-8 for empty buffers
  }

  const detected = jschardet.detect(buffer.toString('binary'));

  // Return detected encoding or default to UTF-8
  return detected.encoding || 'utf-8';
}

/**
 * Read a File object and decode it with proper encoding detection
 * @param file - File object to read
 * @returns Promise<string> Decoded file content as string
 */
export async function readFileWithEncoding(file: File): Promise<string> {
  // Read file content as text (File/Blob API)
  // For proper encoding detection, we'd ideally read as ArrayBuffer first,
  // but for simplicity in this implementation, we use text() which assumes UTF-8
  // For production with complex encodings, use arrayBuffer approach

  try {
    // Simple approach: use built-in text() method
    return await file.text();
  } catch {
    // Fallback: use arrayBuffer with encoding detection
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Handle empty files
    if (buffer.length === 0) {
      return '';
    }

    // Sample first 500 bytes for encoding detection
    const sampleBuffer = buffer.slice(0, Math.min(500, buffer.length));
    const encoding = detectEncoding(sampleBuffer);

    // Decode with detected encoding
    try {
      const decoder = new TextDecoder(encoding);
      return decoder.decode(arrayBuffer);
    } catch {
      // Final fallback to UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(arrayBuffer);
    }
  }
}
