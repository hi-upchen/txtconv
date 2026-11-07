/**
 * @jest-environment node
 */
// The shared jest mock of opencc-js only converts Simplified to Traditional.
// These tests need the real dictionaries, so the factory below wraps the real
// full build of opencc-js and ignores the mocked preset objects.
jest.mock('opencc-js', () => {
  const real = jest.requireActual('../../node_modules/opencc-js/dist/umd/full.js');
  return {
    ConverterFactory: () => real.Converter({ from: 'twp', to: 'cn' }),
  };
});

import {
  convertTraditionalToSimplified,
  generateSimplifiedFilename,
} from '@/lib/tw2cn-converter';

describe('convertTraditionalToSimplified', () => {
  it('converts Taiwan phrases to mainland phrases', async () => {
    expect(await convertTraditionalToSimplified('軟體、網路、資訊、影片')).toBe(
      '软件、网络、信息、视频'
    );
  });

  it('keeps line breaks and punctuation', async () => {
    expect(await convertTraditionalToSimplified('軟體\n網路，資訊。')).toBe('软件\n网络，信息。');
  });

  it('returns an empty string for empty input', async () => {
    expect(await convertTraditionalToSimplified('')).toBe('');
  });

  it('leaves text that is already Simplified unchanged', async () => {
    expect(await convertTraditionalToSimplified('软件')).toBe('软件');
  });
});

describe('generateSimplifiedFilename', () => {
  it('converts the name and keeps the extension', async () => {
    expect(await generateSimplifiedFilename('軟體筆記.txt')).toBe('软件笔记.txt');
  });

  it('replaces invalid characters and falls back for empty names', async () => {
    expect(await generateSimplifiedFilename('a:b.txt')).toBe('a_b.txt');
    expect(await generateSimplifiedFilename('.txt')).toBe('.txt');
  });
});
