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
  });
});
