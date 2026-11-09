/**
 * Partial conversion of a text file that is over the free size limit.
 * The free user gets the first part of the file instead of only an error.
 * All work happens in the browser, like the rest of the conversion.
 */

import { BLOCKED_EXTENSIONS, KINDLE_EXTENSIONS, FREE_MAX_FILE_SIZE_LABEL } from '@/lib/file-validator';

/** Where the cut landed. 'whole' means the input was already within the limit. */
export type PartialCutKind = 'whole' | 'line' | 'character';

export interface PartialCut {
  bytes: Uint8Array;
  kind: PartialCutKind;
}

/**
 * True when the file type can be cut safely as plain text.
 * EPUB is a ZIP archive, so a cut file would be broken.
 * Blocked and Kindle types stay rejected, as before.
 */
export function canConvertPartially(fileName: string): boolean {
  const name = fileName.toLowerCase();
  if (name.endsWith('.epub')) return false;
  return ![...BLOCKED_EXTENSIONS, ...KINDLE_EXTENSIONS].some((ext) => name.endsWith(ext));
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Cuts file bytes to at most `limit` bytes without splitting a character.
 *
 * The cut prefers the end of the last full line. A newline byte (0x0A) never
 * appears inside a UTF-8, GBK or Big5 character, so a line cut is always safe.
 * When the last newline sits in the first half of the allowed bytes, a UTF-8
 * file is cut at its last complete character instead, to keep more text.
 *
 * Returns null when no safe cut exists, for example UTF-16 files, binary data,
 * or a long non-UTF-8 run with no newline. The caller then keeps the old
 * rejection. Input within the limit comes back unchanged.
 *
 * @param bytes - Bytes of the file, at least the first `limit + 1` bytes
 * @param limit - Largest allowed output size in bytes
 */
export function cutToLimit(bytes: Uint8Array, limit: number): PartialCut | null {
  if (bytes.length <= limit) return { bytes, kind: 'whole' };

  // UTF-16 stores newline as two bytes, so byte cuts could split a character.
  const isUtf16Bom =
    (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);
  if (isUtf16Bom) return null;

  const head = bytes.subarray(0, limit);
  if (head.indexOf(0x00) !== -1) return null;

  const lineEnd = head.lastIndexOf(0x0a) + 1; // 0 when there is no newline
  if (lineEnd >= limit / 2) return { bytes: head.subarray(0, lineEnd), kind: 'line' };

  // Back off at most three bytes to reach the end of a complete UTF-8 character.
  for (let back = 0; back < 4 && back < limit; back++) {
    const candidate = head.subarray(0, limit - back);
    if (isValidUtf8(candidate)) return { bytes: candidate, kind: 'character' };
  }

  if (lineEnd > 0) return { bytes: head.subarray(0, lineEnd), kind: 'line' };
  return null;
}

/**
 * Adds the partial label to a converted file name, before the extension.
 * Example: "小說.txt" becomes "小說_前5MB部分.txt".
 */
export function partialFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  return `${base}_前${FREE_MAX_FILE_SIZE_LABEL}部分${ext}`;
}
