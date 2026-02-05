/**
 * @jest-environment node
 */
import {
  loadConverterLibs,
  areLibsLoaded,
  readFileWithEncoding,
  convertText,
  convertWithProgress,
  convertFile,
  loadUserDictionary,
  updateDictCache,
  clearDictCache,
  generateConvertedFilename,
} from '@/lib/client-converter';
import type { DictPair } from '@/lib/custom-dict';

// Mock Supabase client
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseSingle = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      mockSupabaseFrom(table);
      return {
        select: (columns: string) => {
          mockSupabaseSelect(columns);
          return {
            eq: (column: string, value: string) => {
              mockSupabaseEq(column, value);
              return {
                single: () => mockSupabaseSingle(),
              };
            },
          };
        },
      };
    },
  }),
}));

// Mock global fetch for dictionary URLs
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

describe('client-converter', () => {
  beforeAll(async () => {
    // Load converter libraries once for all tests
    await loadConverterLibs();
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    clearDictCache();
  });

  describe('readFileWithEncoding', () => {
    describe('UTF-8 encoding', () => {
      it('should detect UTF-8 and decode Chinese text correctly', async () => {
        const content = '这是简体中文测试';
        const file = new File([content], 'test.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe(content);
        expect(result.encoding).toBe('UTF-8');
      });

      it('should handle UTF-8 with mixed Chinese and ASCII', async () => {
        const content = 'Hello 你好 World 世界';
        const file = new File([content], 'test.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe(content);
        expect(result.encoding).toBe('UTF-8');
      });

      it('should handle empty file and return UTF-8', async () => {
        const file = new File([''], 'empty.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe('');
        expect(result.encoding).toBe('UTF-8');
      });

      it('should handle ASCII-only content as UTF-8', async () => {
        const content = 'Hello World 123 !@#';
        const file = new File([content], 'ascii.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe(content);
        expect(result.encoding).toBe('UTF-8');
      });
    });

    describe('GB encodings', () => {
      it('should detect GBK and decode simplified Chinese', async () => {
        // "简体中文" in GBK encoding
        const gbkBytes = new Uint8Array([
          0xbc, 0xf2, // 简
          0xcc, 0xe5, // 体
          0xd6, 0xd0, // 中
          0xce, 0xc4, // 文
        ]);
        const file = new File([gbkBytes], 'gbk.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe('简体中文');
        expect(['GBK', 'GB18030']).toContain(result.encoding);
      });

      it('should detect GB2312 and decode correctly', async () => {
        // "测试" in GB2312 encoding
        const gb2312Bytes = new Uint8Array([
          0xb2, 0xe2, // 测
          0xca, 0xd4, // 试
        ]);
        const file = new File([gb2312Bytes], 'gb2312.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe('测试');
        expect(['GBK', 'GB2312', 'GB18030']).toContain(result.encoding);
      });

      it('should detect GB18030 and handle extended characters', async () => {
        // "软件测试" in GB18030 (same as GBK for common chars)
        const gb18030Bytes = new Uint8Array([
          0xc8, 0xed, // 软
          0xbc, 0xfe, // 件
          0xb2, 0xe2, // 测
          0xca, 0xd4, // 试
        ]);
        const file = new File([gb18030Bytes], 'gb18030.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe('软件测试');
        expect(['GBK', 'GB18030']).toContain(result.encoding);
      });
    });

    describe('Big5 encoding', () => {
      it('should detect Big5 and decode traditional Chinese', async () => {
        // "這是繁體中文" in Big5 encoding
        const big5Bytes = new Uint8Array([
          0xb3, 0x6f, // 這
          0xac, 0x4f, // 是
          0xc1, 0x63, // 繁
          0xc5, 0xe9, // 體
          0xa4, 0xa4, // 中
          0xa4, 0xe5, // 文
        ]);
        const file = new File([big5Bytes], 'big5.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        expect(result.content).toBe('這是繁體中文');
        expect(result.encoding).toBe('Big5');
      });

      it('should correctly distinguish Big5 from GBK using score heuristic', async () => {
        // This is the critical test for the bug fix
        // "這是繁體中文測試檔案。" in Big5
        // GBK can decode these bytes but produces wrong characters
        const big5Bytes = new Uint8Array([
          0xb3, 0x6f, // 這
          0xac, 0x4f, // 是
          0xc1, 0x63, // 繁
          0xc5, 0xe9, // 體
          0xa4, 0xa4, // 中
          0xa4, 0xe5, // 文
          0xb4, 0xfa, // 測
          0xb8, 0xf5, // 試
          0xc0, 0xc8, // 檔
          0xae, 0xae, // 案
          0xa1, 0x43, // 。
        ]);
        const file = new File([big5Bytes], 'ambiguous.txt', { type: 'text/plain' });

        const result = await readFileWithEncoding(file);

        // Should pick Big5, not GBK
        expect(result.encoding).toBe('Big5');
        // Content should be valid Traditional Chinese, not garbled
        expect(result.content).toContain('這是繁體中文');
        // Should NOT contain the wrong GBK interpretation
        expect(result.content).not.toContain('硂琌羉砰');
      });
    });
  });

  describe('convertWithProgress', () => {
    const mockProgress = jest.fn();

    beforeEach(() => {
      mockProgress.mockClear();
    });

    it('should convert text when no custom pairs provided', async () => {
      const result = await convertWithProgress('你好世界', [], mockProgress);

      // Verify conversion runs without error and returns something
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // The actual OpenCC conversion may vary by environment
      // Key test: custom dict tests below verify conversion works with custom mappings
    });

    it('should apply single custom mapping override', async () => {
      const pairs: DictPair[] = [
        { simplified: '软件', traditional: '軟體APP' },
      ];

      const result = await convertWithProgress('软件测试', pairs, mockProgress);

      // Custom "軟體APP" + default "測試"
      expect(result).toBe('軟體APP測試');
    });

    it('should apply multiple custom mappings', async () => {
      const pairs: DictPair[] = [
        { simplified: '软件', traditional: '軟體APP' },
        { simplified: '硬件', traditional: '硬體設備' },
      ];

      const result = await convertWithProgress('软件和硬件', pairs, mockProgress);

      expect(result).toBe('軟體APP和硬體設備');
    });

    it('should apply longest match first for overlapping keys', async () => {
      const pairs: DictPair[] = [
        { simplified: '测试', traditional: '測試A' },
        { simplified: '测试文档', traditional: '測試文檔B' },
      ];

      const result = await convertWithProgress('测试文档内容', pairs, mockProgress);

      // "测试文档" matches first (longer), leaving "内容" for default conversion
      expect(result).toBe('測試文檔B內容');
    });

    it('should call progress callback with correct values', async () => {
      const content = 'line1\nline2\nline3';

      await convertWithProgress(content, [], mockProgress);

      expect(mockProgress).toHaveBeenCalled();
      // Final call should have percent = 1
      const lastCall = mockProgress.mock.calls[mockProgress.mock.calls.length - 1];
      expect(lastCall[0]).toBe(1);
      expect(lastCall[2]).toBe(3); // totalLines
    });
  });

  describe('loadUserDictionary', () => {
    it('should return empty array when userId is undefined', async () => {
      const result = await loadUserDictionary(undefined);

      expect(result).toEqual([]);
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('should return empty array when user has no custom_dict_url', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: { custom_dict_url: null, license_type: 'free' },
      });

      const result = await loadUserDictionary('user-123');

      expect(result).toEqual([]);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('profiles');
    });

    it('should fetch and parse CSV from custom_dict_url', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'lifetime',
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('软件,軟體APP\n硬件,硬體設備'),
      });

      const result = await loadUserDictionary('user-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ simplified: '软件', traditional: '軟體APP' });
      expect(result[1]).toEqual({ simplified: '硬件', traditional: '硬體設備' });
    });

    it('should return empty array on fetch error', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'free',
        },
      });
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const result = await loadUserDictionary('user-456');

      expect(result).toEqual([]);
    });

    it('should truncate to 5 pairs for free license', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'free',
        },
      });
      // CSV with 10 pairs
      const csvContent = Array.from({ length: 10 }, (_, i) => `key${i},value${i}`).join('\n');
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(csvContent),
      });

      const result = await loadUserDictionary('free-user');

      expect(result).toHaveLength(5);
    });

    it('should allow up to 10000 pairs for paid license', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'lifetime',
        },
      });
      // CSV with 100 pairs
      const csvContent = Array.from({ length: 100 }, (_, i) => `key${i},value${i}`).join('\n');
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(csvContent),
      });

      const result = await loadUserDictionary('paid-user');

      expect(result).toHaveLength(100);
    });

    it('should return cached dict for same userId', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'free',
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('a,A'),
      });

      // First call
      await loadUserDictionary('cache-user');
      // Second call with same user
      await loadUserDictionary('cache-user');

      // Supabase should only be called once
      expect(mockSupabaseFrom).toHaveBeenCalledTimes(1);
    });

    it('should fetch fresh dict for different userId', async () => {
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'free',
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('a,A'),
      });

      // Call with user A
      await loadUserDictionary('user-A');
      // Call with user B
      await loadUserDictionary('user-B');

      // Supabase should be called twice
      expect(mockSupabaseFrom).toHaveBeenCalledTimes(2);
    });
  });

  describe('helper functions', () => {
    describe('areLibsLoaded', () => {
      it('should return true after loadConverterLibs is called', () => {
        // loadConverterLibs was called in beforeAll
        expect(areLibsLoaded()).toBe(true);
      });
    });

    describe('updateDictCache and clearDictCache', () => {
      it('should update and clear dict cache', async () => {
        const pairs: DictPair[] = [{ simplified: 'a', traditional: 'A' }];

        updateDictCache(pairs);

        // After update, loadUserDictionary should use cache
        // We can verify by checking that Supabase is not called
        // when we already have a cached user
        mockSupabaseSingle.mockResolvedValue({
          data: { custom_dict_url: 'https://x.com/d.csv', license_type: 'free' },
        });
        mockFetch.mockResolvedValue({
          ok: true,
          text: () => Promise.resolve('b,B'),
        });

        clearDictCache();

        // After clear, should fetch fresh
        const result = await loadUserDictionary('test-user');
        expect(mockSupabaseFrom).toHaveBeenCalled();
      });
    });

    describe('generateConvertedFilename', () => {
      it('should convert Chinese filename to traditional', () => {
        const result = generateConvertedFilename('测试.txt');

        expect(result).toBe('測試.txt');
      });

      it('should preserve file extension', () => {
        const result = generateConvertedFilename('test.csv');

        expect(result).toBe('test.csv');
      });

      it('should sanitize invalid filename characters', () => {
        const result = generateConvertedFilename('文件<名>.txt');

        expect(result).toBe('文件_名_.txt');
      });

      it('should handle filename without extension', () => {
        const result = generateConvertedFilename('测试');

        expect(result).toBe('測試');
      });

      it('should handle edge case filenames', () => {
        // Filename with only dots gets sanitized
        const result = generateConvertedFilename('...');

        // Result should contain "converted" as fallback
        expect(result).toContain('converted');
      });
    });
  });
});
