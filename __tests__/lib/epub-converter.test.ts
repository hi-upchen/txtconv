/**
 * Tests for the in-browser EPUB converter: builds a small EPUB fixture with
 * fflate (mimetype + META-INF/container.xml + one .opf + two .xhtml with
 * Simplified text + one fake binary image), converts it, and asserts the
 * output is a valid EPUB whose mimetype entry is first and stored, whose
 * text entries were converted, whose binary entry is byte-identical, and
 * whose entry paths are preserved.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import {
  convertEpubBytes,
  isEpubTextEntry,
  EPUB_TEXT_EXTENSIONS,
} from '@/lib/epub-converter';

/**
 * A minimal test converter mirroring the shape of the real pipeline: it
 * only needs to demonstrate Simplified-to-Traditional substitution on the
 * two sample words used in the fixture.
 */
function testConvert(text: string): string {
  return text.replace(/软件/g, '軟體').replace(/网络/g, '網路');
}

/** Raw bytes standing in for a binary image entry (a fake 1x1 "PNG"). */
const FAKE_IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0xff, 0xfe]);

const XHTML_1 =
  '<?xml version="1.0" encoding="UTF-8"?>\n<html><body><p>软件测试</p></body></html>';
const XHTML_2 =
  '<?xml version="1.0" encoding="UTF-8"?>\n<html><body><p>网络世界</p></body></html>';
const OPF =
  '<?xml version="1.0" encoding="UTF-8"?>\n<package><metadata><title>软件网络</title></metadata></package>';
const CONTAINER_XML =
  '<?xml version="1.0"?>\n<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>';

/**
 * Builds a minimal but structurally valid EPUB archive for testing. The
 * mimetype entry is deliberately placed first and stored, matching a real
 * EPUB produced by e-book tooling.
 */
function buildFixtureEpub(): Uint8Array {
  return zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(CONTAINER_XML),
    'OEBPS/content.opf': strToU8(OPF),
    'OEBPS/chapter1.xhtml': strToU8(XHTML_1),
    'OEBPS/chapter2.xhtml': strToU8(XHTML_2),
    'OEBPS/images/cover.png': FAKE_IMAGE_BYTES,
  });
}

/**
 * Reads the first local file entry's name and compression method from a raw
 * ZIP byte stream. Method 0 = stored, 8 = deflate. Used to assert the
 * mimetype entry comes first and is uncompressed per the EPUB OCF spec.
 */
function readFirstEntry(zip: Uint8Array): { name: string; method: number } {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // Local file header: signature(4) version(2) flags(2) method(2) ...
  const method = view.getUint16(8, true);
  const nameLen = view.getUint16(26, true);
  const nameBytes = zip.subarray(30, 30 + nameLen);
  return { name: strFromU8(nameBytes), method };
}

describe('isEpubTextEntry', () => {
  it.each(EPUB_TEXT_EXTENSIONS)('treats %s entries as convertible text', (ext) => {
    expect(isEpubTextEntry(`OEBPS/file${ext}`)).toBe(true);
  });

  it('treats binary parts as non-text', () => {
    expect(isEpubTextEntry('OEBPS/images/cover.png')).toBe(false);
    expect(isEpubTextEntry('mimetype')).toBe(false);
    expect(isEpubTextEntry('fonts/font.otf')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isEpubTextEntry('OEBPS/Chapter.XHTML')).toBe(true);
  });
});

describe('convertEpubBytes', () => {
  it('produces a valid zip whose mimetype entry is first and stored', () => {
    const out = convertEpubBytes(buildFixtureEpub(), testConvert);

    const first = readFirstEntry(out);
    expect(first.name).toBe('mimetype');
    expect(first.method).toBe(0); // stored, uncompressed

    // Output unzips cleanly and the mimetype value is intact.
    const entries = unzipSync(out);
    expect(strFromU8(entries['mimetype'])).toBe('application/epub+zip');
  });

  it('converts Simplified text in xhtml and opf entries', () => {
    const entries = unzipSync(convertEpubBytes(buildFixtureEpub(), testConvert));

    expect(strFromU8(entries['OEBPS/chapter1.xhtml'])).toContain('軟體');
    expect(strFromU8(entries['OEBPS/chapter1.xhtml'])).not.toContain('软件');
    expect(strFromU8(entries['OEBPS/chapter2.xhtml'])).toContain('網路');
    expect(strFromU8(entries['OEBPS/content.opf'])).toContain('軟體');
    expect(strFromU8(entries['OEBPS/content.opf'])).toContain('網路');
  });

  it('passes binary entries through byte-for-byte', () => {
    const entries = unzipSync(convertEpubBytes(buildFixtureEpub(), testConvert));
    expect(Array.from(entries['OEBPS/images/cover.png'])).toEqual(
      Array.from(FAKE_IMAGE_BYTES)
    );
  });

  it('preserves every entry path', () => {
    const original = Object.keys(unzipSync(buildFixtureEpub())).sort();
    const converted = Object.keys(
      unzipSync(convertEpubBytes(buildFixtureEpub(), testConvert))
    ).sort();
    expect(converted).toEqual(original);
  });

  it('reports per-entry conversion progress ending at 1', () => {
    const fractions: number[] = [];
    convertEpubBytes(buildFixtureEpub(), testConvert, {
      onEntryProgress: (f) => fractions.push(f),
    });
    // Three text entries: content.opf, chapter1.xhtml, chapter2.xhtml.
    expect(fractions.length).toBe(3);
    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it('synthesizes a mimetype entry when the source lacks one', () => {
    const noMime = zipSync({
      'OEBPS/content.opf': strToU8(OPF),
    });
    const out = convertEpubBytes(noMime, testConvert);
    const first = readFirstEntry(out);
    expect(first.name).toBe('mimetype');
    expect(first.method).toBe(0);
    expect(strFromU8(unzipSync(out)['mimetype'])).toBe('application/epub+zip');
  });
});
