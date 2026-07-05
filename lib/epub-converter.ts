/**
 * In-browser EPUB (.epub) Simplified-to-Traditional conversion.
 *
 * An EPUB is a ZIP archive (an OCF container). This module unzips it with
 * fflate, runs a caller-supplied text-conversion function on the
 * human-readable text entries (content documents, package metadata, and
 * legacy navigation), and re-zips while preserving every other entry
 * (images, fonts, CSS, binary parts) byte-for-byte. The archive is rebuilt
 * with the `mimetype` entry first and stored (uncompressed) as required by
 * the EPUB OCF specification, so the output stays a valid, readable EPUB
 * with only its text converted.
 *
 * The module is intentionally free of any OpenCC / custom-dictionary
 * coupling: it receives the conversion as a plain `(text) => text` callback
 * so it can reuse the existing pipeline in lib/client-converter.ts and stay
 * unit-testable without loading the converter. Everything runs on the
 * user's device; the book is never uploaded.
 */

import { unzipSync, zipSync, strToU8, strFromU8, type Zippable } from 'fflate';

/**
 * File extensions whose entries hold convertible UTF-8 text: EPUB content
 * documents (.xhtml/.html/.htm), the package document (.opf), the legacy
 * NCX navigation (.ncx), and any plain-text parts (.txt). The EPUB spec
 * mandates UTF-8 for these, so no encoding detection is needed.
 */
export const EPUB_TEXT_EXTENSIONS = ['.xhtml', '.html', '.htm', '.opf', '.ncx', '.txt'] as const;

/**
 * The MIME type an EPUB's reserved `mimetype` entry must contain, and the
 * type used for the converted download Blob.
 */
export const EPUB_MIME_TYPE = 'application/epub+zip';

/**
 * Determines whether an archive entry holds convertible UTF-8 text.
 *
 * @param path - Entry path inside the EPUB (e.g. "OEBPS/chapter1.xhtml")
 * @returns True when the entry is a text document that should be converted;
 *   false for images, fonts, CSS, and other binary parts that pass through
 *   unchanged
 */
export function isEpubTextEntry(path: string): boolean {
  const lower = path.toLowerCase();
  return EPUB_TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Options for {@link convertEpubBytes}. */
export interface EpubConvertOptions {
  /**
   * Reports progress of the per-entry text conversion as a fraction in the
   * range 0..1 (called once per converted text entry). Binary passthrough
   * entries do not advance this fraction.
   */
  onEntryProgress?: (fraction: number) => void;
}

/**
 * Converts the text content of an EPUB archive from Simplified to
 * Traditional Chinese, returning a new, valid EPUB archive.
 *
 * Text entries (see {@link EPUB_TEXT_EXTENSIONS}) are decoded as UTF-8, run
 * through `convert`, and re-encoded as UTF-8. Every other entry is copied
 * byte-for-byte. The rebuilt archive places the `mimetype` entry first and
 * stores it uncompressed (compression level 0) per the EPUB OCF spec; all
 * original entry paths are preserved.
 *
 * @param input - Raw bytes of the source .epub file
 * @param convert - Text conversion function; receives decoded UTF-8 text of
 *   one entry and returns the converted text. Reuse the existing OpenCC +
 *   custom-dictionary pipeline here.
 * @param options - Optional progress reporting; see {@link EpubConvertOptions}
 * @returns Bytes of a new, valid EPUB with only its text converted
 * @example
 *   const out = convertEpubBytes(epubBytes, (t) => converter(t));
 */
export function convertEpubBytes(
  input: Uint8Array,
  convert: (text: string) => string,
  options: EpubConvertOptions = {}
): Uint8Array {
  const entries = unzipSync(input);
  const paths = Object.keys(entries);

  const rebuilt: Zippable = {};

  // The `mimetype` entry must come first and be stored (uncompressed). Pass
  // through the original value when present; otherwise synthesize the
  // spec-required value so the output is still a valid EPUB.
  const mimetypeValue = entries['mimetype']
    ? strFromU8(entries['mimetype'])
    : EPUB_MIME_TYPE;
  rebuilt['mimetype'] = [strToU8(mimetypeValue), { level: 0 }];

  // Count text entries up front so progress reports a stable denominator.
  const textEntryCount = paths.filter(
    (p) => p !== 'mimetype' && isEpubTextEntry(p)
  ).length;

  let convertedCount = 0;
  for (const path of paths) {
    // `mimetype` was already placed first above.
    if (path === 'mimetype') continue;

    const bytes = entries[path];
    if (isEpubTextEntry(path)) {
      // strFromU8 decodes as UTF-8 by default, matching the EPUB spec.
      const converted = convert(strFromU8(bytes));
      rebuilt[path] = strToU8(converted);
      convertedCount++;
      options.onEntryProgress?.(
        textEntryCount === 0 ? 1 : convertedCount / textEntryCount
      );
    } else {
      // Binary parts (images, fonts, CSS, cover, etc.) pass through unchanged.
      rebuilt[path] = bytes;
    }
  }

  if (textEntryCount === 0) {
    options.onEntryProgress?.(1);
  }

  return zipSync(rebuilt);
}
