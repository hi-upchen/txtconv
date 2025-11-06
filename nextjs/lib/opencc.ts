import { ConverterFactory } from 'opencc-js';

// Lazy-load converter instance (singleton pattern)
let converterInstance: any = null;

/**
 * Get OpenCC converter instance with lazy loading
 * Uses s2twp configuration (Simplified to Traditional Chinese - Taiwan with Phrases)
 * @returns Promise<Converter> Converter function
 */
export async function getConverter() {
  if (!converterInstance) {
    // Dynamically import preset dictionaries (lazy loading)
    const { from, to } = await import('opencc-js/preset');
    // Only load s → twp dictionary (Simplified Chinese → Traditional Chinese Taiwan with Phrases)
    converterInstance = ConverterFactory(from.cn, to.twp);
  }
  return converterInstance;
}

/**
 * Convert simplified Chinese text to traditional Chinese
 * @param text - Text to convert
 * @returns Promise<string> Converted text
 */
export async function convertText(text: string): Promise<string> {
  const converter = await getConverter();
  return converter(text);
}

/**
 * Convert file content line by line with progress callback
 * @param fileContent - File content as string
 * @param onProgress - Optional progress callback (0.0 to 1.0)
 * @returns Promise<string> Converted file content
 */
export async function convertFile(
  fileContent: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Handle empty file
  if (!fileContent) {
    if (onProgress) onProgress(1.0);
    return '';
  }

  const converter = await getConverter();
  const lines = fileContent.split('\n');
  const totalLines = lines.length;
  const convertedLines: string[] = [];

  // Report progress every 1% (or at least every 100 lines)
  const progressInterval = Math.max(1, Math.ceil(totalLines / 100));

  for (let i = 0; i < totalLines; i++) {
    convertedLines.push(converter(lines[i]));

    // Report progress
    if (onProgress && (i % progressInterval === 0 || i === totalLines - 1)) {
      const percent = (i + 1) / totalLines;
      onProgress(percent);
    }
  }

  return convertedLines.join('\n');
}
