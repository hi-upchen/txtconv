import type { LicenseType } from '@/types/user';

export interface DictPair {
  simplified: string;
  traditional: string;
}

export interface DictValidationError {
  line: number;
  message: string;
}

/**
 * Returns the maximum number of custom dictionary pairs allowed for a license type.
 */
export function getDictPairLimit(licenseType: LicenseType): number {
  if (licenseType === 'free') return 5;
  return 10000;
}

/**
 * Parses CSV text into DictPair[]. One pair per line, comma-separated.
 * Skips blank lines. Only returns pairs from valid lines
 * (exactly one comma, non-empty sides after trimming).
 */
export function parseDictionary(content: string): DictPair[] {
  if (!content.trim()) return [];

  const pairs: DictPair[] = [];

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;

    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount !== 1) continue;

    const [left, right] = line.split(',');
    const simplified = left.trim();
    const traditional = right.trim();

    if (!simplified || !traditional) continue;

    pairs.push({ simplified, traditional });
  }

  return pairs;
}

/**
 * Validates CSV dictionary content and returns all errors found.
 * Blank lines are silently skipped (no error).
 */
export function validateDictionary(content: string): DictValidationError[] {
  if (!content.trim()) return [];

  const errors: DictValidationError[] = [];
  const seen = new Map<string, number>(); // simplified key -> line number

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (!line.trim()) continue;

    const commaCount = (line.match(/,/g) || []).length;

    if (commaCount === 0) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行格式錯誤：缺少逗號` });
      continue;
    }

    if (commaCount > 1) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行格式錯誤：只能有一個逗號` });
      continue;
    }

    const [left, right] = line.split(',');
    const simplified = left.trim();
    const traditional = right.trim();

    if (!simplified || !traditional) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行格式錯誤：簡體和繁體都不能為空` });
      continue;
    }

    const existingLine = seen.get(simplified);
    if (existingLine !== undefined) {
      errors.push({
        line: lineNum,
        message: `第 ${lineNum} 行重複：'${simplified}' 已在第 ${existingLine} 行定義`,
      });
      continue;
    }

    seen.set(simplified, lineNum);
  }

  return errors;
}

/**
 * Applies custom dictionary pairs using placeholder-based conversion.
 *
 * 1. Sort pairs by simplified key length descending (longest match first)
 * 2. Replace all occurrences of each simplified key with null-byte placeholder
 * 3. Run converter on the text (placeholders pass through untouched)
 * 4. Replace placeholders with corresponding traditional values
 */
export function applyCustomDict(
  text: string,
  pairs: DictPair[],
  converter: (text: string) => string
): string {
  if (pairs.length === 0) return converter(text);

  // Sort by key length descending for longest-match-first
  const sorted = [...pairs].sort(
    (a, b) => b.simplified.length - a.simplified.length
  );

  // Step 1: Replace simplified keys with placeholders
  let result = text;
  for (let i = 0; i < sorted.length; i++) {
    const key = sorted[i].simplified;
    // Escape regex special characters in the key
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), `\x00DICT_${i}\x00`);
  }

  // Step 2: Run converter on text with placeholders
  result = converter(result);

  // Step 3: Replace placeholders with traditional values
  for (let i = 0; i < sorted.length; i++) {
    result = result.replace(
      new RegExp(`\x00DICT_${i}\x00`, 'g'),
      sorted[i].traditional
    );
  }

  return result;
}
