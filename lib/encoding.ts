/**
 * Read a File object and decode it with proper encoding detection
 * Optimized for Chinese text conversion (GB2312, GBK, GB18030, Big5)
 * @param file - File object to read
 * @returns Promise<string> Decoded file content as string
 */
export async function readFileWithEncoding(file: File): Promise<string> {
  // Always use arrayBuffer with encoding detection for proper handling of non-UTF-8 files
  // file.text() assumes UTF-8 and will silently corrupt GB2312/GBK/Big5 content
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Handle empty files
  if (buffer.length === 0) {
    return '';
  }

  // Try UTF-8 first with fatal mode (most common for modern files)
  // fatal: true makes it throw on invalid UTF-8 sequences
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    const decoded = utf8Decoder.decode(arrayBuffer);
    return decoded;
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
        return decoded;
      }
    } catch {
      // Encoding not supported, try next
      continue;
    }
  }

  // Final fallback to UTF-8 with lenient mode (allows replacement characters)
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(arrayBuffer);
}
