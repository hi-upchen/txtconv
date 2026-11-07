/**
 * Traditional (Taiwan) to Simplified Chinese conversion, run in the browser.
 *
 * The converter uses the OpenCC `twp` to `cn` dictionaries. They convert
 * Taiwan phrases to mainland phrases, for example 軟體 to 软件.
 * The dictionaries load on first use, so the home page bundle stays small.
 */

let converterInstance: ((text: string) => string) | null = null;

/** Returns the shared Traditional to Simplified converter, loading it once. */
export async function getTw2CnConverter(): Promise<(text: string) => string> {
  if (!converterInstance) {
    const { ConverterFactory } = await import('opencc-js');
    const { from, to } = await import('opencc-js/preset');
    converterInstance = ConverterFactory(from.twp, to.cn);
  }
  return converterInstance;
}

/** Converts Traditional Chinese text to Simplified Chinese. */
export async function convertTraditionalToSimplified(text: string): Promise<string> {
  if (!text) return '';
  const convert = await getTw2CnConverter();
  return convert(text);
}

/**
 * Builds the download name for a converted file.
 * The name is converted too, stripped of characters that are invalid in file
 * names, and keeps its extension. An empty name becomes "converted".
 */
export async function generateSimplifiedFilename(originalName: string): Promise<string> {
  const lastDot = originalName.lastIndexOf('.');
  const base = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const extension = lastDot > 0 ? originalName.slice(lastDot) : '';
  const converted = await convertTraditionalToSimplified(base);
  const sanitized = converted
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+$/g, '')
    .trim();
  return (sanitized || 'converted') + extension;
}
