# Client-Converter Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive unit tests for `lib/client-converter.ts` covering encoding detection, custom dictionary integration, and Supabase interactions.

**Architecture:** Jest tests with real `encoding-japanese` and `opencc-js` libraries, mocking only Supabase client and global fetch. Tests organized by function: encoding detection (9), custom dict (5), loadUserDictionary (8), helpers (10), full pipeline (5).

**Tech Stack:** Jest, TypeScript, encoding-japanese, opencc-js, jest mocks for Supabase

---

## Task 1: Test File Setup and Mocks

**Files:**
- Create: `__tests__/lib/client-converter.test.ts`

**Step 1: Create test file with imports and mock setup**

```typescript
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

  // Tests will be added in subsequent tasks
});
```

**Step 2: Verify test file is valid**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="client-converter" --passWithNoTests`
Expected: PASS (no tests yet, but file compiles)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add client-converter test file with mock setup"
```

---

## Task 2: Encoding Detection Tests - UTF-8 Cases

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add UTF-8 encoding tests**

Add inside the `describe('client-converter')` block:

```typescript
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
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="UTF-8" --verbose`
Expected: PASS (4 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add UTF-8 encoding detection tests"
```

---

## Task 3: Encoding Detection Tests - GBK/GB2312/GB18030

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add GB encoding tests**

Add inside `describe('readFileWithEncoding')`:

```typescript
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
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="GB encodings" --verbose`
Expected: PASS (3 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add GBK/GB2312/GB18030 encoding detection tests"
```

---

## Task 4: Encoding Detection Tests - Big5 and Ambiguity

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add Big5 and ambiguity tests**

Add inside `describe('readFileWithEncoding')`:

```typescript
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
        // "這是繁體中文測試檔案。軟體和硬體都是電腦的重要組成部分。" in Big5
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
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="Big5" --verbose`
Expected: PASS (2 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add Big5 encoding and GBK/Big5 ambiguity tests"
```

---

## Task 5: Custom Dictionary Integration Tests

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add custom dictionary tests**

Add inside `describe('client-converter')`:

```typescript
  describe('convertWithProgress', () => {
    const mockProgress = jest.fn();

    beforeEach(() => {
      mockProgress.mockClear();
    });

    it('should use default OpenCC when no custom pairs provided', async () => {
      const result = await convertWithProgress('软件测试', [], mockProgress);

      // Default OpenCC s2twp conversion
      expect(result).toBe('軟體測試');
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
        { simplified: '软件', traditional: '軟體' },
        { simplified: '软件工程', traditional: '軟體工程專業' },
      ];

      const result = await convertWithProgress('软件工程师', pairs, mockProgress);

      // "软件工程" matches first (longer), leaving "师" for default conversion
      expect(result).toBe('軟體工程專業師');
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
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="convertWithProgress" --verbose`
Expected: PASS (5 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add custom dictionary integration tests"
```

---

## Task 6: loadUserDictionary Tests - Basic Cases

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add loadUserDictionary basic tests**

Add inside `describe('client-converter')`:

```typescript
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
  });
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="loadUserDictionary" --verbose`
Expected: PASS (4 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add loadUserDictionary basic tests"
```

---

## Task 7: loadUserDictionary Tests - Limits and Caching

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add limit and cache tests**

Add inside `describe('loadUserDictionary')`:

```typescript
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
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="loadUserDictionary" --verbose`
Expected: PASS (8 tests total)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add loadUserDictionary limit and cache tests"
```

---

## Task 8: Helper Function Tests

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add helper function tests**

Add inside `describe('client-converter')`:

```typescript
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
        const result = generateConvertedFilename('软件测试.txt');

        expect(result).toBe('軟體測試.txt');
      });

      it('should preserve file extension', () => {
        const result = generateConvertedFilename('文档.csv');

        expect(result).toBe('文檔.csv');
      });

      it('should sanitize invalid filename characters', () => {
        const result = generateConvertedFilename('文件<名>.txt');

        expect(result).toBe('文件_名_.txt');
      });

      it('should handle filename without extension', () => {
        const result = generateConvertedFilename('软件');

        expect(result).toBe('軟體');
      });

      it('should return "converted" for empty filename after sanitization', () => {
        const result = generateConvertedFilename('...');

        expect(result).toBe('converted');
      });
    });
  });
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="helper functions" --verbose`
Expected: PASS (7 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add helper function tests"
```

---

## Task 9: Full Pipeline Tests

**Files:**
- Modify: `__tests__/lib/client-converter.test.ts`

**Step 1: Add full pipeline tests**

Add inside `describe('client-converter')`:

```typescript
  describe('convertFile (full pipeline)', () => {
    const mockProgress = jest.fn();

    beforeEach(() => {
      mockProgress.mockClear();
    });

    it('should convert UTF-8 file without custom dict', async () => {
      const content = '软件测试';
      const file = new File([content], '测试.txt', { type: 'text/plain' });

      const result = await convertFile(file, undefined, mockProgress);

      expect(result.content).toBe('軟體測試');
      expect(result.fileName).toBe('測試.txt');
      expect(result.encoding).toBe('UTF-8');
    });

    it('should convert GBK file with custom dict for logged-in user', async () => {
      // Setup mock for logged-in user with custom dict
      mockSupabaseSingle.mockResolvedValue({
        data: {
          custom_dict_url: 'https://example.com/dict.csv',
          license_type: 'lifetime',
        },
      });
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('软件,自訂軟體'),
      });

      // GBK encoded "软件测试"
      const gbkBytes = new Uint8Array([
        0xc8, 0xed, // 软
        0xbc, 0xfe, // 件
        0xb2, 0xe2, // 测
        0xca, 0xd4, // 试
      ]);
      const file = new File([gbkBytes], 'test.txt', { type: 'text/plain' });

      // Clear cache to force fresh fetch
      clearDictCache();

      const result = await convertFile(file, 'user-123', mockProgress);

      expect(result.content).toBe('自訂軟體測試');
      expect(['GBK', 'GB18030']).toContain(result.encoding);
    });

    it('should convert Big5 file correctly', async () => {
      // Big5 encoded "這是測試"
      const big5Bytes = new Uint8Array([
        0xb3, 0x6f, // 這
        0xac, 0x4f, // 是
        0xb4, 0xfa, // 測
        0xb8, 0xf5, // 試
      ]);
      const file = new File([big5Bytes], 'big5test.txt', { type: 'text/plain' });

      const result = await convertFile(file, undefined, mockProgress);

      expect(result.content).toBe('這是測試');
      expect(result.encoding).toBe('Big5');
    });

    it('should report progress through all stages', async () => {
      const content = '测试';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      await convertFile(file, undefined, mockProgress);

      // Verify progress was called with different stages
      const stages = mockProgress.mock.calls.map(call => call[0].stage);
      expect(stages).toContain('loading-libs');
      expect(stages).toContain('loading-dict');
      expect(stages).toContain('converting');
    });

    it('should handle multi-line file conversion', async () => {
      const content = '第一行\n第二行\n第三行';
      const file = new File([content], 'multiline.txt', { type: 'text/plain' });

      const result = await convertFile(file, undefined, mockProgress);

      const lines = result.content.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('第一行');
      expect(lines[1]).toBe('第二行');
      expect(lines[2]).toBe('第三行');
    });
  });
```

**Step 2: Run tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --testNamePattern="convertFile" --verbose`
Expected: PASS (5 tests)

**Step 3: Commit**

```bash
git add __tests__/lib/client-converter.test.ts
git commit -m "test: add full pipeline integration tests"
```

---

## Task 10: Final Verification

**Files:**
- None (verification only)

**Step 1: Run all client-converter tests**

Run: `npx jest __tests__/lib/client-converter.test.ts --verbose --coverage`
Expected: PASS (~40 tests), coverage report shows client-converter.ts covered

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass (126 existing + ~40 new = ~166 total)

**Step 3: Final commit with coverage info**

```bash
git add -A
git commit -m "test: complete client-converter test suite with full coverage

- Encoding detection: UTF-8, GBK, GB2312, GB18030, Big5 (9 tests)
- GBK/Big5 ambiguity detection with score heuristic
- Custom dictionary integration (5 tests)
- loadUserDictionary with Supabase mocking (8 tests)
- Helper functions (7 tests)
- Full pipeline integration (5 tests)
- Total: ~40 new tests for regression protection"
```

---

## Summary

| Task | Tests Added | Focus |
|------|-------------|-------|
| 1 | 0 | Setup & mocks |
| 2 | 4 | UTF-8 encoding |
| 3 | 3 | GB encodings |
| 4 | 2 | Big5 & ambiguity |
| 5 | 5 | Custom dict |
| 6 | 4 | loadUserDictionary basic |
| 7 | 4 | loadUserDictionary limits/cache |
| 8 | 7 | Helper functions |
| 9 | 5 | Full pipeline |
| 10 | 0 | Verification |

**Total: ~34 tests**
