export interface EncodingDetectionResult {
  content: string;
  encoding: string;
}

/**
 * Read a File object and decode it with proper encoding detection
 * Optimized for Chinese text conversion (GB2312, GBK, GB18030, Big5)
 * @param file - File object to read
 * @returns Promise<EncodingDetectionResult> Decoded file content and detected encoding
 */
export async function readFileWithEncoding(file: File): Promise<EncodingDetectionResult> {
  // Always use arrayBuffer with encoding detection for proper handling of non-UTF-8 files
  // file.text() assumes UTF-8 and will silently corrupt GB2312/GBK/Big5 content
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Handle empty files
  if (buffer.length === 0) {
    return { content: '', encoding: 'UTF-8' };
  }

  // Try UTF-8 first with fatal mode (most common for modern files)
  // fatal: true makes it throw on invalid UTF-8 sequences
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    const decoded = utf8Decoder.decode(arrayBuffer);
    return { content: decoded, encoding: 'UTF-8' };
  } catch {
    // Not valid UTF-8, try Chinese encodings
  }

  // Try common Chinese encodings in priority order
  // This covers: Simplified Chinese (GB2312, GBK, GB18030) and Traditional Chinese (Big5)
  const chineseEncodings = ['GBK', 'GB18030', 'GB2312', 'Big5'];

  for (const encoding of chineseEncodings) {
    try {
      const decoder = new TextDecoder(encoding);
      const decoded = decoder.decode(arrayBuffer);
      // If no replacement characters (�), encoding is likely correct
      if (!decoded.includes('�')) {
        return { content: decoded, encoding };
      }
    } catch {
      // Encoding not supported, try next
      continue;
    }
  }

  // Final fallback to UTF-8 with lenient mode (allows replacement characters)
  const decoder = new TextDecoder('utf-8');
  return { content: decoder.decode(arrayBuffer), encoding: 'UTF-8 (fallback)' };
}
