/**
 * @jest-environment node
 */
import { detectEncoding, readFileWithEncoding } from '@/lib/encoding';

describe('Encoding Detection Helper', () => {
  describe('detectEncoding', () => {
    it('should detect UTF-8 encoding', () => {
      const utf8Text = Buffer.from('Hello World 你好世界', 'utf-8');
      const encoding = detectEncoding(utf8Text);
      expect(encoding.toLowerCase()).toContain('utf');
    });

    it('should detect ASCII encoding', () => {
      const asciiText = Buffer.from('Hello World 123', 'ascii');
      const encoding = detectEncoding(asciiText);
      // ASCII is usually detected as UTF-8 or ASCII
      expect(['utf-8', 'ascii', 'utf8']).toContain(encoding.toLowerCase());
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.from('');
      const encoding = detectEncoding(emptyBuffer);
      expect(encoding).toBeDefined();
      expect(typeof encoding).toBe('string');
    });

    it('should return a valid encoding string', () => {
      const buffer = Buffer.from('Test content');
      const encoding = detectEncoding(buffer);
      expect(encoding).toBeDefined();
      expect(encoding.length).toBeGreaterThan(0);
    });
  });

  describe('readFileWithEncoding', () => {
    it('should read UTF-8 file correctly', async () => {
      const content = 'Hello World 你好世界';
      const file = new File([content], 'test.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      expect(result).toBe(content);
    });

    it('should handle empty file', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      expect(result).toBe('');
    });

    it('should handle files with special characters', async () => {
      const content = '特殊字符：©®™€£¥';
      const file = new File([content], 'special.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      expect(result).toBe(content);
    });

    it('should detect and read Chinese text files', async () => {
      const content = '简体中文测试内容\n繁體中文測試內容';
      const file = new File([content], 'chinese.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      expect(result).toContain('简体中文');
      expect(result).toContain('繁體中文');
    });

    it('should handle multiline files', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = new File([content], 'multiline.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      const lines = result.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
    });
  });
});
