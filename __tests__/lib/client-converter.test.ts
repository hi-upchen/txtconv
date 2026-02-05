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
  });
});
