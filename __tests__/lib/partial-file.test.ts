import { cutToLimit, canConvertPartially, partialFileName } from '@/lib/partial-file';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(b);

describe('cutToLimit', () => {
  it('returns input unchanged when within the limit', () => {
    const bytes = enc('你好\n世界');
    const cut = cutToLimit(bytes, bytes.length);
    expect(cut).toEqual({ bytes, kind: 'whole' });
  });

  it('cuts at the last full line', () => {
    const bytes = enc('第一行\n第二行\n第三行\n');
    // limit lands inside the third line
    const limit = enc('第一行\n第二行\n').length + 4;
    const cut = cutToLimit(bytes, limit)!;
    expect(cut.kind).toBe('line');
    expect(dec(cut.bytes)).toBe('第一行\n第二行\n');
    expect(cut.bytes.length).toBeLessThanOrEqual(limit);
  });

  it('never splits a multi-byte character when there is no newline', () => {
    const bytes = enc('汉字'.repeat(20)); // 3 bytes per character
    for (const limit of [30, 31, 32, 33]) {
      const cut = cutToLimit(bytes, limit)!;
      expect(cut.kind).toBe('character');
      expect(cut.bytes.length).toBeLessThanOrEqual(limit);
      expect(() => dec(cut.bytes)).not.toThrow();
      expect(dec(cut.bytes).length).toBe(Math.floor(limit / 3));
    }
  });

  it('keeps four-byte characters whole', () => {
    const bytes = enc('😀'.repeat(10));
    const cut = cutToLimit(bytes, 18)!;
    expect(dec(cut.bytes)).toBe('😀'.repeat(4));
  });

  it('prefers a far-away line end over a character cut when the newline is late', () => {
    const bytes = enc('a'.repeat(40) + '\n' + '汉'.repeat(10));
    const cut = cutToLimit(bytes, 50)!;
    expect(cut.kind).toBe('line');
    expect(cut.bytes.length).toBe(41);
  });

  it('uses a character cut when the only newline is in the first half', () => {
    const bytes = enc('ab\n' + '汉'.repeat(30));
    const cut = cutToLimit(bytes, 50)!;
    expect(cut.kind).toBe('character');
    expect(() => dec(cut.bytes)).not.toThrow();
  });

  it('cuts GBK bytes only at a newline', () => {
    // GBK bytes for "汉字" are B7 BA D7 D6 style pairs; trail bytes are never 0x0A
    const line = [0xba, 0xba, 0xd7, 0xd6, 0x0a];
    const bytes = new Uint8Array([...line, ...line, ...line]);
    const cut = cutToLimit(bytes, 12)!;
    expect(cut.kind).toBe('line');
    expect(cut.bytes.length).toBe(10);
  });

  it('returns null for non-UTF-8 data without a newline', () => {
    const bytes = new Uint8Array(40).fill(0xba);
    expect(cutToLimit(bytes, 20)).toBeNull();
  });

  it('returns null for UTF-16 and binary data', () => {
    expect(cutToLimit(new Uint8Array([0xff, 0xfe, 0x61, 0x00, 0x0a, 0x00, 0x62, 0x00]), 5)).toBeNull();
    expect(cutToLimit(new Uint8Array([0x61, 0x00, 0x62, 0x00, 0x63, 0x00]), 4)).toBeNull();
  });
});

describe('canConvertPartially', () => {
  it('allows text types and refuses archives and binaries', () => {
    expect(canConvertPartially('novel.txt')).toBe(true);
    expect(canConvertPartially('sub.SRT')).toBe(true);
    expect(canConvertPartially('book.epub')).toBe(false);
    expect(canConvertPartially('book.mobi')).toBe(false);
    expect(canConvertPartially('movie.mp4')).toBe(false);
  });
});

describe('partialFileName', () => {
  it('adds the partial label before the extension', () => {
    expect(partialFileName('小說.txt')).toBe('小說_前5MB部分.txt');
    expect(partialFileName('noext')).toBe('noext_前5MB部分');
  });
});
