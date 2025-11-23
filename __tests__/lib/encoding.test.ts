/**
 * @jest-environment node
 */
import { readFileWithEncoding, EncodingDetectionResult } from '@/lib/encoding';

describe('Encoding Detection Helper', () => {
  describe('readFileWithEncoding', () => {
    it('should read UTF-8 file correctly and return encoding', async () => {
      const content = 'Hello World 你好世界';
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

    it('should handle files with special characters', async () => {
      const content = '特殊字符：©®™€£¥';
      const file = new File([content], 'special.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      expect(result.content).toBe(content);
      expect(result.encoding).toBe('UTF-8');
    });

    it('should detect and read Chinese text files', async () => {
      const content = '简体中文测试内容\n繁體中文測試內容';
      const file = new File([content], 'chinese.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      expect(result.content).toContain('简体中文');
      expect(result.content).toContain('繁體中文');
      expect(result.encoding).toBe('UTF-8');
    });

    it('should handle multiline files', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = new File([content], 'multiline.txt', { type: 'text/plain' });

      const result = await readFileWithEncoding(file);
      const lines = result.content.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
      expect(result.encoding).toBe('UTF-8');
    });

    // TDD: Tests for non-UTF-8 encodings (GB2312/GBK)
    // These tests expose the bug where file.text() assumes UTF-8
    it('should correctly read GB2312 encoded Chinese text and detect encoding', async () => {
      // Create GB2312 encoded content: "简体中文" (Simplified Chinese)
      // GB2312 hex bytes for these characters
      const gb2312Bytes = new Uint8Array([
        0xbc, 0xf2, // 简
        0xcc, 0xe5, // 体
        0xd6, 0xd0, // 中
        0xce, 0xc4, // 文
      ]);

      const file = new File([gb2312Bytes], 'gb2312.txt', { type: 'text/plain' });
      const result = await readFileWithEncoding(file);

      // Should properly decode to "简体中文"
      expect(result.content).toBe('简体中文');
      // Should detect as GB2312 or GBK (GBK is superset of GB2312)
      expect(['GB2312', 'GBK', 'GB18030']).toContain(result.encoding);
    });

    it('should correctly read GBK encoded Chinese text with special chars and detect encoding', async () => {
      // GBK encoding for "嬌妾為寵" (Traditional Chinese phrase)
      // Correct GBK-encoded bytes
      const gbkBytes = new Uint8Array([
        0x8b, 0xc9, // 嬌
        0xe6, 0xaa, // 妾
        0x9e, 0xe9, // 為
        0x8c, 0x99, // 寵
      ]);

      const file = new File([gbkBytes], 'gbk.txt', { type: 'text/plain' });
      const result = await readFileWithEncoding(file);

      // Should properly decode to "嬌妾為寵"
      expect(result.content).toBe('嬌妾為寵');
      // Should detect as GBK or GB18030
      expect(['GBK', 'GB18030']).toContain(result.encoding);
    });

    it('should handle mixed encoding with ASCII and GB2312', async () => {
      // "Hello 世界" - ASCII + GB2312
      // Correct GB2312 bytes for 世界
      const mixedBytes = new Uint8Array([
        0x48, 0x65, 0x6c, 0x6c, 0x6f, // Hello
        0x20, // space
        0xca, 0xc0, // 世 (correct!)
        0xbd, 0xe7, // 界 (correct!)
      ]);

      const file = new File([mixedBytes], 'mixed.txt', { type: 'text/plain' });
      const result = await readFileWithEncoding(file);

      expect(result.content).toContain('Hello');
      expect(result.content).toContain('世界');
      expect(['GB2312', 'GBK', 'GB18030']).toContain(result.encoding);
    });

    it('should not corrupt non-UTF-8 files by assuming UTF-8', async () => {
      // Real-world scenario: GB2312 file should NOT be corrupted
      // Correct GB2312 bytes for 测试
      const gb2312Bytes = new Uint8Array([
        0xb2, 0xe2, // 测 (correct!)
        0xca, 0xd4, // 试 (correct!)
      ]);

      const file = new File([gb2312Bytes], 'test.txt', { type: 'text/plain' });
      const result = await readFileWithEncoding(file);

      // Should NOT contain UTF-8 replacement characters or garbage
      expect(result.content).not.toContain('�');
      expect(result.content).toBe('测试');
      expect(['GB2312', 'GBK', 'GB18030']).toContain(result.encoding);
    });
  });
});
