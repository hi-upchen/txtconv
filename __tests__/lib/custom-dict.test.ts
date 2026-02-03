import {
  DictPair,
  parseDictionary,
  validateDictionary,
  getDictPairLimit,
  applyCustomDict,
} from '@/lib/custom-dict';

describe('custom-dict', () => {
  // ─── parseDictionary ────────────────────────────────────────────────

  describe('parseDictionary', () => {
    it('should parse valid CSV pairs', () => {
      const content = '代码,程式碼\n内存,記憶體';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式碼' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should skip blank lines', () => {
      const content = '代码,程式碼\n\n内存,記憶體\n\n';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式碼' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should return empty array for empty string', () => {
      expect(parseDictionary('')).toEqual([]);
    });

    it('should trim whitespace from keys and values', () => {
      const content = '  代码 , 程式碼  \n 内存 ,記憶體 ';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式碼' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should skip lines with no comma', () => {
      const content = '代码,程式碼\n沒有逗號\n内存,記憶體';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式碼' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should skip lines with multiple commas', () => {
      const content = '代码,程式碼\na,b,c\n内存,記憶體';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式碼' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should skip lines with empty left side', () => {
      const content = ',程式碼\n内存,記憶體';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should skip lines with empty right side', () => {
      const content = '代码,\n内存,記憶體';
      const result = parseDictionary(content);
      expect(result).toEqual([
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should handle a single valid pair', () => {
      const result = parseDictionary('简体,繁體');
      expect(result).toEqual([{ simplified: '简体', traditional: '繁體' }]);
    });

    it('should return empty array when all lines are blank', () => {
      expect(parseDictionary('\n\n\n')).toEqual([]);
    });
  });

  // ─── validateDictionary ─────────────────────────────────────────────

  describe('validateDictionary', () => {
    it('should return no errors for valid content', () => {
      const content = '代码,程式碼\n内存,記憶體';
      expect(validateDictionary(content)).toEqual([]);
    });

    it('should return error for missing comma', () => {
      const content = '沒有逗號';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：缺少逗號' },
      ]);
    });

    it('should return error for multiple commas', () => {
      const content = 'a,b,c';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：只能有一個逗號' },
      ]);
    });

    it('should return error for empty left side', () => {
      const content = ',繁體';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：簡體和繁體都不能為空' },
      ]);
    });

    it('should return error for empty right side', () => {
      const content = '简体,';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：簡體和繁體都不能為空' },
      ]);
    });

    it('should return error for empty both sides', () => {
      const content = ',';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：簡體和繁體都不能為空' },
      ]);
    });

    it('should detect duplicate simplified keys', () => {
      const content = '代码,程式碼\n内存,記憶體\n代码,原始碼';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 3, message: "第 3 行重複：'代码' 已在第 1 行定義" },
      ]);
    });

    it('should skip blank lines without errors and keep correct line numbering', () => {
      const content = '代码,程式碼\n\n\n内存,記憶體';
      const errors = validateDictionary(content);
      expect(errors).toEqual([]);
    });

    it('should report correct line numbers with blank lines present', () => {
      const content = '\n沒有逗號\n\n代码,程式碼\n代码,原始碼';
      const errors = validateDictionary(content);
      expect(errors).toEqual([
        { line: 2, message: '第 2 行格式錯誤：缺少逗號' },
        { line: 5, message: "第 5 行重複：'代码' 已在第 4 行定義" },
      ]);
    });

    it('should return multiple errors for multiple invalid lines', () => {
      const content = '沒有逗號\na,b,c\n,空左\n右空,';
      const errors = validateDictionary(content);
      expect(errors).toHaveLength(4);
      expect(errors[0]).toEqual({ line: 1, message: '第 1 行格式錯誤：缺少逗號' });
      expect(errors[1]).toEqual({ line: 2, message: '第 2 行格式錯誤：只能有一個逗號' });
      expect(errors[2]).toEqual({ line: 3, message: '第 3 行格式錯誤：簡體和繁體都不能為空' });
      expect(errors[3]).toEqual({ line: 4, message: '第 4 行格式錯誤：簡體和繁體都不能為空' });
    });

    it('should return no errors for empty content', () => {
      expect(validateDictionary('')).toEqual([]);
    });

    it('should return no errors for only blank lines', () => {
      expect(validateDictionary('\n\n\n')).toEqual([]);
    });
  });

  // ─── getDictPairLimit ───────────────────────────────────────────────

  describe('getDictPairLimit', () => {
    it('should return 5 for free license', () => {
      expect(getDictPairLimit('free')).toBe(5);
    });

    it('should return 10000 for monthly license', () => {
      expect(getDictPairLimit('monthly')).toBe(10000);
    });

    it('should return 10000 for lifetime license', () => {
      expect(getDictPairLimit('lifetime')).toBe(10000);
    });
  });

  // ─── applyCustomDict ───────────────────────────────────────────────

  describe('applyCustomDict', () => {
    // A simple mock converter that simulates opencc-js behavior
    const mockConverter = (text: string): string => {
      return text
        .replace(/简/g, '簡')
        .replace(/体/g, '體')
        .replace(/中文/g, '中文')
        .replace(/测试/g, '測試')
        .replace(/内容/g, '內容');
    };

    it('should apply custom pairs instead of converter for matched text', () => {
      const pairs: DictPair[] = [
        { simplified: '测试', traditional: '測驗' }, // override mock's 测试→測試
      ];
      const result = applyCustomDict('这是测试内容', pairs, mockConverter);
      // '测试' should become '測驗' (custom), not '測試' (converter)
      // '内容' should become '內容' (converter, no custom override)
      expect(result).toBe('这是測驗內容');
    });

    it('should let converter handle non-custom text normally', () => {
      const pairs: DictPair[] = [
        { simplified: '代码', traditional: '程式碼' },
      ];
      // '简体' has no custom pair, so converter handles it: 简→簡, 体→體
      const result = applyCustomDict('简体', pairs, mockConverter);
      expect(result).toBe('簡體');
    });

    it('should handle multiple custom pairs', () => {
      const pairs: DictPair[] = [
        { simplified: '测试', traditional: '測驗' },
        { simplified: '内容', traditional: '內文' },
      ];
      const result = applyCustomDict('测试内容', pairs, mockConverter);
      expect(result).toBe('測驗內文');
    });

    it('should apply longest match first', () => {
      const pairs: DictPair[] = [
        { simplified: '测', traditional: 'A' },
        { simplified: '测试', traditional: '測驗' },
      ];
      // '测试' (longer) should match first, not '测' (shorter)
      const result = applyCustomDict('测试', pairs, mockConverter);
      expect(result).toBe('測驗');
    });

    it('should return converter(text) when pairs is empty', () => {
      const result = applyCustomDict('简体中文', [], mockConverter);
      expect(result).toBe('簡體中文');
    });

    it('should handle multiple occurrences of the same key', () => {
      const pairs: DictPair[] = [
        { simplified: '测试', traditional: '測驗' },
      ];
      const result = applyCustomDict('测试和测试', pairs, mockConverter);
      expect(result).toBe('測驗和測驗');
    });

    it('should pass through text with no matching keys unchanged (except converter)', () => {
      const pairs: DictPair[] = [
        { simplified: '代码', traditional: '程式碼' },
      ];
      // No '代码' in input, just '简体' which converter handles
      const result = applyCustomDict('简体', pairs, mockConverter);
      expect(result).toBe('簡體');
    });

    it('should handle text that is entirely a custom key', () => {
      const pairs: DictPair[] = [
        { simplified: '测试', traditional: '測驗' },
      ];
      const result = applyCustomDict('测试', pairs, mockConverter);
      expect(result).toBe('測驗');
    });

    it('should not interfere with converter on non-matching segments', () => {
      const pairs: DictPair[] = [
        { simplified: '测试', traditional: '測驗' },
      ];
      // '简体' is not a custom key; converter converts 简→簡 and 体→體
      // '测试' is a custom key; should become '測驗'
      const result = applyCustomDict('简体测试', pairs, mockConverter);
      expect(result).toBe('簡體測驗');
    });

    it('should handle overlapping keys correctly with longest match', () => {
      const pairs: DictPair[] = [
        { simplified: '简', traditional: 'X' },
        { simplified: '简体', traditional: 'Y' },
        { simplified: '简体中文', traditional: 'Z' },
      ];
      const result = applyCustomDict('简体中文', pairs, mockConverter);
      expect(result).toBe('Z');
    });
  });
});
