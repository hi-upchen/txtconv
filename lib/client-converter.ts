'use client';

import { applyCustomDict, parseDictionary, type DictPair } from '@/lib/custom-dict';
import { createClient } from '@/lib/supabase/client';

// Lazy-loaded library instances
let encodingLib: typeof import('encoding-japanese') | null = null;
let converterInstance: ((text: string) => string) | null = null;

// Dictionary cache
let cachedDictPairs: DictPair[] | null = null;
let dictCacheUserId: string | null = null;

export type ConversionStage = 'loading-libs' | 'loading-dict' | 'converting' | 'archiving' | 'complete';

export interface ConversionProgress {
  stage: ConversionStage;
  percent: number;
  currentLine?: number;
  totalLines?: number;
}

export type ProgressCallback = (progress: ConversionProgress) => void;

export interface ConversionResult {
  content: string;
  fileName: string;
  encoding: string;
}

/**
 * Load converter libraries (encoding-japanese + OpenCC-js)
 * Called lazily on first conversion
 */
export async function loadConverterLibs(onProgress?: (percent: number) => void): Promise<void> {
  if (!encodingLib) {
    encodingLib = await import('encoding-japanese');
    onProgress?.(0.5);
  }

  if (!converterInstance) {
    const { ConverterFactory } = await import('opencc-js');
    const { from, to } = await import('opencc-js/preset');
    converterInstance = ConverterFactory(from.cn, to.twp);
    onProgress?.(1);
  }
}

/**
 * Check if converter libraries are loaded
 */
export function areLibsLoaded(): boolean {
  return encodingLib !== null && converterInstance !== null;
}

/**
 * Update the dictionary cache (called by CustomDictEditor when saving)
 */
export function updateDictCache(pairs: DictPair[]): void {
  cachedDictPairs = pairs;
}

/**
 * Clear the dictionary cache (called on logout)
 */
export function clearDictCache(): void {
  cachedDictPairs = null;
  dictCacheUserId = null;
}

/**
 * Load user's custom dictionary with caching
 */
export async function loadUserDictionary(userId: string | undefined): Promise<DictPair[]> {
  if (!userId) return [];

  // Return cached dictionary if same user
  if (cachedDictPairs !== null && dictCacheUserId === userId) {
    return cachedDictPairs;
  }

  try {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_dict_url, license_type')
      .eq('id', userId)
      .single();

    if (!profile?.custom_dict_url) {
      cachedDictPairs = [];
      dictCacheUserId = userId;
      return [];
    }

    const response = await fetch(profile.custom_dict_url);
    if (!response.ok) {
      cachedDictPairs = [];
      dictCacheUserId = userId;
      return [];
    }

    const csvText = await response.text();
    const pairs = parseDictionary(csvText);

    // Apply license limit
    const limit = profile.license_type === 'free' ? 5 : 10000;
    cachedDictPairs = pairs.slice(0, limit);
    dictCacheUserId = userId;

    return cachedDictPairs;
  } catch (error) {
    console.error('Error loading custom dictionary:', error);
    return [];
  }
}

/**
 * Calculate a score for how likely the text is valid Chinese.
 * Higher score = more likely valid Chinese text.
 * This helps distinguish between GBK and Big5 decoded results.
 */
function calculateChineseScore(text: string): number {
  let score = 0;
  const len = text.length;
  if (len === 0) return 0;

  // Count characters in common CJK ranges
  let cjkCount = 0;
  let punctuationCount = 0;
  let controlChars = 0;

  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);

    // Common CJK Unified Ideographs (U+4E00 to U+9FFF)
    if (code >= 0x4E00 && code <= 0x9FFF) {
      cjkCount++;
    }
    // CJK Extension A (U+3400 to U+4DBF)
    else if (code >= 0x3400 && code <= 0x4DBF) {
      cjkCount++;
    }
    // Chinese punctuation (U+3000 to U+303F)
    else if (code >= 0x3000 && code <= 0x303F) {
      punctuationCount++;
    }
    // Fullwidth ASCII and punctuation (U+FF00 to U+FFEF)
    else if (code >= 0xFF00 && code <= 0xFFEF) {
      punctuationCount++;
    }
    // Control characters and unusual symbols (likely wrong encoding)
    else if (code < 0x20 && code !== 0x0A && code !== 0x0D && code !== 0x09) {
      controlChars++;
    }
    // Private Use Area (U+E000 to U+F8FF) - often indicates wrong encoding
    else if (code >= 0xE000 && code <= 0xF8FF) {
      controlChars++;
    }
  }

  // Calculate score
  // High CJK ratio is good
  score = (cjkCount / len) * 100;

  // Punctuation is okay
  score += (punctuationCount / len) * 10;

  // Control characters are bad (penalty)
  score -= (controlChars / len) * 50;

  return score;
}

/**
 * Detect encoding and decode file content.
 * Uses a multi-strategy approach:
 * 1. Try UTF-8 with fatal mode (most common for modern files)
 * 2. Try common Chinese encodings with TextDecoder
 * 3. Fall back to encoding-japanese for Japanese encodings
 */
export async function readFileWithEncoding(file: File): Promise<{ content: string; encoding: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Handle empty files
  if (uint8Array.length === 0) {
    return { content: '', encoding: 'UTF-8' };
  }

  // Strategy 1: Try UTF-8 with fatal mode (throws on invalid UTF-8)
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    const content = utf8Decoder.decode(arrayBuffer);
    return { content, encoding: 'UTF-8' };
  } catch {
    // Not valid UTF-8, continue to other encodings
  }

  // Strategy 2: Try common Chinese encodings using TextDecoder
  // We decode with multiple encodings and pick the best match
  // GBK/GB18030 and Big5 can decode each other's bytes without replacement characters,
  // so we need a heuristic to distinguish them
  const chineseEncodings = ['GBK', 'GB18030', 'Big5'] as const;
  const decodedResults: { encoding: string; content: string; score: number }[] = [];

  for (const encoding of chineseEncodings) {
    try {
      const decoder = new TextDecoder(encoding);
      const content = decoder.decode(arrayBuffer);
      // Skip if has replacement characters
      if (content.includes('\uFFFD')) continue;

      // Calculate a score based on common Chinese character patterns
      // Valid Chinese text should have recognizable character patterns
      const score = calculateChineseScore(content);
      decodedResults.push({ encoding, content, score });
    } catch {
      // Encoding not supported by browser, try next
      continue;
    }
  }

  // Pick the encoding with the highest score
  if (decodedResults.length > 0) {
    decodedResults.sort((a, b) => b.score - a.score);
    return { content: decodedResults[0].content, encoding: decodedResults[0].encoding };
  }

  // Strategy 3: Fall back to encoding-japanese for Japanese and other encodings
  if (encodingLib) {
    const detected = encodingLib.detect(uint8Array);
    if (detected) {
      const unicodeArray = encodingLib.convert(uint8Array, {
        to: 'UNICODE',
        from: detected,
      }) as number[];
      const content = encodingLib.codeToString(unicodeArray);

      // Map encoding names to display names
      const encodingDisplayMap: Record<string, string> = {
        'UTF8': 'UTF-8',
        'SJIS': 'Shift_JIS',
        'EUCJP': 'EUC-JP',
        'JIS': 'ISO-2022-JP',
        'UNICODE': 'UTF-16',
      };

      return {
        content,
        encoding: encodingDisplayMap[detected] || detected,
      };
    }
  }

  // Final fallback: UTF-8 with lenient mode (allows replacement characters)
  const decoder = new TextDecoder('utf-8');
  return { content: decoder.decode(arrayBuffer), encoding: 'UTF-8 (fallback)' };
}

/**
 * Convert text using OpenCC
 */
export function convertText(text: string): string {
  if (!converterInstance) {
    throw new Error('Converter not loaded. Call loadConverterLibs first.');
  }
  return converterInstance(text);
}

/**
 * Convert file content line by line with progress callback
 */
export async function convertWithProgress(
  fileContent: string,
  customPairs: DictPair[],
  onProgress: (percent: number, currentLine: number, totalLines: number) => void
): Promise<string> {
  if (!converterInstance) {
    throw new Error('Converter not loaded. Call loadConverterLibs first.');
  }

  // Handle empty file
  if (!fileContent) {
    onProgress(1, 0, 0);
    return '';
  }

  const lines = fileContent.split('\n');
  const totalLines = lines.length;
  const convertedLines: string[] = [];

  // Report progress every 1% (or at least every 100 lines)
  const progressInterval = Math.max(1, Math.ceil(totalLines / 100));

  for (let i = 0; i < totalLines; i++) {
    if (customPairs.length > 0) {
      convertedLines.push(applyCustomDict(lines[i], customPairs, converterInstance));
    } else {
      convertedLines.push(converterInstance(lines[i]));
    }

    // Report progress
    if (i % progressInterval === 0 || i === totalLines - 1) {
      const percent = (i + 1) / totalLines;
      onProgress(percent, i + 1, totalLines);

      // Yield to UI thread every progress update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return convertedLines.join('\n');
}

/**
 * Generate converted filename
 */
export function generateConvertedFilename(originalName: string): string {
  if (!converterInstance) {
    throw new Error('Converter not loaded. Call loadConverterLibs first.');
  }

  const lastDot = originalName.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const extension = lastDot > 0 ? originalName.slice(lastDot) : '';

  // Convert filename from simplified to traditional Chinese
  const convertedName = converterInstance(nameWithoutExt);

  // Basic sanitization (remove invalid filename characters)
  const sanitized = convertedName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+$/g, '')
    .trim();

  return (sanitized || 'converted') + extension;
}

/**
 * Full conversion pipeline for a single file
 */
export async function convertFile(
  file: File,
  userId: string | undefined,
  onProgress: ProgressCallback
): Promise<ConversionResult> {
  // Stage 1: Load libraries (0-10%)
  onProgress({ stage: 'loading-libs', percent: 0 });
  await loadConverterLibs((p) => {
    onProgress({ stage: 'loading-libs', percent: p * 0.1 });
  });

  // Stage 2: Load dictionary (10-15%)
  onProgress({ stage: 'loading-dict', percent: 0.1 });
  const customPairs = await loadUserDictionary(userId);
  onProgress({ stage: 'loading-dict', percent: 0.15 });

  // Stage 3: Read file and detect encoding
  onProgress({ stage: 'converting', percent: 0.15 });
  const { content: fileContent, encoding } = await readFileWithEncoding(file);

  // Stage 4: Convert with progress (15-95%)
  const convertedContent = await convertWithProgress(
    fileContent,
    customPairs,
    (percent, currentLine, totalLines) => {
      onProgress({
        stage: 'converting',
        percent: 0.15 + percent * 0.8,
        currentLine,
        totalLines,
      });
    }
  );

  // Generate converted filename
  const fileName = generateConvertedFilename(file.name);

  onProgress({ stage: 'converting', percent: 0.95 });

  return {
    content: convertedContent,
    fileName,
    encoding,
  };
}
