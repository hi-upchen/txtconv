import { getConverter, convertText, convertFile, convertFileWithCustomDict } from '@/lib/opencc';

describe('OpenCC Helper', () => {
  describe('getConverter', () => {
    it('should return a converter instance', async () => {
      const converter = await getConverter();
      expect(converter).toBeDefined();
      expect(typeof converter).toBe('function');
    });

    it('should return the same converter instance on multiple calls (caching)', async () => {
      const converter1 = await getConverter();
      const converter2 = await getConverter();
      expect(converter1).toBe(converter2);
    });
  });

  describe('convertText', () => {
    it('should convert simplified Chinese to traditional Chinese', async () => {
      const simplified = '简体中文';
      const result = await convertText(simplified);
      expect(result).toBe('簡體中文');
    });

    it('should handle empty strings', async () => {
      const result = await convertText('');
      expect(result).toBe('');
    });

    it('should handle strings with mixed Chinese and English', async () => {
      const mixed = 'Hello 世界 World';
      const result = await convertText(mixed);
      expect(result).toContain('Hello');
      expect(result).toContain('World');
      expect(result).toContain('世界');
    });

    it('should handle pure English text', async () => {
      const english = 'Hello World';
      const result = await convertText(english);
      expect(result).toBe('Hello World');
    });
  });

  describe('convertFile', () => {
    it('should convert multi-line file content', async () => {
      const fileContent = '第一行简体中文\n第二行简体中文\n第三行简体中文';
      const result = await convertFile(fileContent);
      expect(result).toContain('第一行簡體中文');
      expect(result).toContain('第二行簡體中文');
      expect(result).toContain('第三行簡體中文');
    });

    it('should call progress callback during conversion', async () => {
      const fileContent = Array(100).fill('简体中文').join('\n');
      const progressUpdates: number[] = [];

      await convertFile(fileContent, (percent) => {
        progressUpdates.push(percent);
      });

      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      // Last update should be 1.0 (100%)
      expect(progressUpdates[progressUpdates.length - 1]).toBe(1.0);
      // Progress should be increasing
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
      }
    }, 10000); // Increase timeout to 10s to account for development delay

    it('should work without progress callback', async () => {
      const fileContent = '简体中文\n测试内容';
      const result = await convertFile(fileContent);
      expect(result).toContain('簡體中文');
      expect(result).toContain('測試內容');
    });

    it('should preserve line breaks', async () => {
      const fileContent = '第一行\n第二行\n第三行';
      const result = await convertFile(fileContent);
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
    });

    it('should handle empty file', async () => {
      const result = await convertFile('');
      expect(result).toBe('');
    });

    it('should handle single line file', async () => {
      const fileContent = '简体中文';
      const result = await convertFile(fileContent);
      expect(result).toBe('簡體中文');
    });
  });

  describe('convertFileWithCustomDict', () => {
    it('should apply custom dict pairs during conversion', async () => {
      const customPairs = [{ simplified: '代码', traditional: '程式' }];
      const result = await convertFileWithCustomDict('代码和简体', customPairs);
      expect(result).toContain('程式');
      expect(result).toContain('簡體');
    });

    it('should behave like convertFile when custom pairs is empty', async () => {
      const result = await convertFileWithCustomDict('简体中文', []);
      const normalResult = await convertFile('简体中文');
      expect(result).toBe(normalResult);
    });

    it('should call progress callback', async () => {
      const customPairs = [{ simplified: '代码', traditional: '程式' }];
      const updates: number[] = [];
      await convertFileWithCustomDict('代码\n简体\n内容', customPairs, (p) => updates.push(p));
      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1]).toBe(1.0);
    });

    it('should handle empty file', async () => {
      const result = await convertFileWithCustomDict('', [{ simplified: '代码', traditional: '程式' }]);
      expect(result).toBe('');
    });

    it('should handle multi-line content with custom dict', async () => {
      const customPairs = [{ simplified: '代码', traditional: '程式' }];
      const result = await convertFileWithCustomDict('第一行代码\n第二行内容', customPairs);
      const lines = result.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('程式');
    });
  });
});
