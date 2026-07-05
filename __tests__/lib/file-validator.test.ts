/**
 * Tests for license-tier-aware file validation: size limits per plan
 * (Free 5MB / Pro 100MB), upgrade-CTA flagging, and format blocking.
 */
import {
  validateFile,
  getMaxFileSize,
  FREE_MAX_FILE_SIZE,
  PRO_MAX_FILE_SIZE,
} from '@/lib/file-validator';

/**
 * Creates a File object of the given byte size without allocating the
 * full buffer (size is faked via Object.defineProperty for speed).
 */
function makeFile(name: string, size: number): File {
  const file = new File(['x'], name, { type: 'text/plain' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('getMaxFileSize', () => {
  it('returns 5MB for free tier and guests (default)', () => {
    expect(getMaxFileSize('free')).toBe(FREE_MAX_FILE_SIZE);
    expect(getMaxFileSize()).toBe(FREE_MAX_FILE_SIZE);
  });

  it('returns 100MB for lifetime and monthly tiers', () => {
    expect(getMaxFileSize('lifetime')).toBe(PRO_MAX_FILE_SIZE);
    expect(getMaxFileSize('monthly')).toBe(PRO_MAX_FILE_SIZE);
  });
});

describe('validateFile size limits', () => {
  it('accepts a file under 5MB for free tier', () => {
    const result = validateFile(makeFile('a.txt', 4 * 1024 * 1024));
    expect(result.valid).toBe(true);
  });

  it('rejects a 10MB file for free tier with upgrade flag and size_limit_free reason', () => {
    const result = validateFile(makeFile('novel.txt', 10 * 1024 * 1024), 'free');
    expect(result.valid).toBe(false);
    expect(result.upgradeAvailable).toBe(true);
    expect(result.error).toContain('5MB');
    expect(result.reason).toBe('size_limit_free');
  });

  it('rejects a file over 100MB for free tier without upgrade flag (size_limit_pro reason)', () => {
    const result = validateFile(makeFile('huge.txt', 120 * 1024 * 1024), 'free');
    expect(result.valid).toBe(false);
    expect(result.upgradeAvailable).toBeUndefined();
    expect(result.reason).toBe('size_limit_pro');
  });

  it('accepts a 10MB file for lifetime tier', () => {
    const result = validateFile(makeFile('novel.txt', 10 * 1024 * 1024), 'lifetime');
    expect(result.valid).toBe(true);
  });

  it('rejects a file over 100MB for lifetime tier without upgrade flag (size_limit_pro reason)', () => {
    const result = validateFile(makeFile('huge.txt', 120 * 1024 * 1024), 'lifetime');
    expect(result.valid).toBe(false);
    expect(result.upgradeAvailable).toBeUndefined();
    expect(result.error).toContain('100MB');
    expect(result.reason).toBe('size_limit_pro');
  });

  it('rejects empty files with empty reason', () => {
    const result = validateFile(makeFile('empty.txt', 0));
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('leaves reason unset on valid files', () => {
    const result = validateFile(makeFile('ok.txt', 1024));
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe('validateFile format blocking', () => {
  it('rejects blocked extensions regardless of tier with blocked_type reason', () => {
    const result = validateFile(makeFile('movie.mp4', 1024), 'lifetime');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('blocked_type');
  });

  it('accepts srt subtitle files', () => {
    const result = validateFile(makeFile('subs.srt', 1024));
    expect(result.valid).toBe(true);
  });

  it('accepts epub e-books (converted in-browser, no longer blocked)', () => {
    const result = validateFile(makeFile('book.epub', 1024));
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it.each(['book.mobi', 'book.azw', 'book.azw3'])(
    'rejects Kindle format %s with a Calibre-to-EPUB hint',
    (name) => {
      const result = validateFile(makeFile(name, 1024));
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('blocked_type');
      expect(result.error).toContain('Calibre');
    }
  );
});
