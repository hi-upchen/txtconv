import { sanitizeFilename } from '@/lib/filename-sanitizer';

describe('sanitizeFilename', () => {
  describe('Normal filenames', () => {
    it('should keep valid alphanumeric filenames unchanged', () => {
      expect(sanitizeFilename('file.txt')).toBe('file.txt');
      expect(sanitizeFilename('MyDocument123.pdf')).toBe('MyDocument123.pdf');
      expect(sanitizeFilename('report-2024.csv')).toBe('report-2024.csv');
    });

    it('should preserve spaces in filenames', () => {
      expect(sanitizeFilename('my file.txt')).toBe('my file.txt');
      expect(sanitizeFilename('Project Report 2024.docx')).toBe('Project Report 2024.docx');
    });

    it('should preserve underscores and hyphens', () => {
      expect(sanitizeFilename('my_file-name.txt')).toBe('my_file-name.txt');
      expect(sanitizeFilename('test_data_2024-01-01.csv')).toBe('test_data_2024-01-01.csv');
    });

    it('should preserve multiple dots in filename', () => {
      expect(sanitizeFilename('file.backup.txt')).toBe('file.backup.txt');
      expect(sanitizeFilename('archive.2024.01.01.tar.gz')).toBe('archive.2024.01.01.tar.gz');
    });

    it('should preserve common punctuation', () => {
      expect(sanitizeFilename('file (1).txt')).toBe('file (1).txt');
      expect(sanitizeFilename('report [draft].csv')).toBe('report [draft].csv');
      expect(sanitizeFilename('data {v2}.json')).toBe('data {v2}.json');
      expect(sanitizeFilename('file & more.txt')).toBe('file & more.txt');
    });
  });

  describe('Unicode and international characters', () => {
    it('should preserve Chinese characters', () => {
      expect(sanitizeFilename('2025-11-06 SRC霍格沃茨的冰火魔神.txt')).toBe('2025-11-06 SRC霍格沃茨的冰火魔神.txt');
      expect(sanitizeFilename('文件名测试.txt')).toBe('文件名测试.txt');
    });

    it('should preserve Chinese punctuation', () => {
      expect(sanitizeFilename('《看见未来》作者：张三.txt')).toBe('《看见未来》作者：张三.txt');
      expect(sanitizeFilename('「日本語」ファイル.txt')).toBe('「日本語」ファイル.txt');
    });

    it('should preserve mixed language filenames', () => {
      expect(sanitizeFilename('2025-11-05 SRC20251105 RITA & 肴 想要更好的自己.srt'))
        .toBe('2025-11-05 SRC20251105 RITA & 肴 想要更好的自己.srt');
    });

    it('should preserve emoji and symbols', () => {
      expect(sanitizeFilename('file 😀 emoji.txt')).toBe('file 😀 emoji.txt');
      expect(sanitizeFilename('report™.txt')).toBe('report™.txt');
    });

    it('should preserve Arabic and other scripts', () => {
      expect(sanitizeFilename('مستند.txt')).toBe('مستند.txt');
      expect(sanitizeFilename('Документ.txt')).toBe('Документ.txt');
    });
  });

  describe('Path traversal attacks', () => {
    it('should sanitize path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
      expect(sanitizeFilename('../../config.txt')).toBe('config.txt');
    });

    it('should remove forward slashes', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('pathtofile.txt');
      expect(sanitizeFilename('/etc/passwd')).toBe('etcpasswd');
    });

    it('should remove backslashes', () => {
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('pathtofile.txt');
      expect(sanitizeFilename('C:\\Windows\\System32\\config.sys')).toBe('CWindowsSystem32config.sys');
    });

    it('should handle mixed path separators', () => {
      expect(sanitizeFilename('../path\\to/file.txt')).toBe('pathtofile.txt');
    });
  });

  describe('Dangerous special characters', () => {
    it('should remove Windows reserved characters', () => {
      expect(sanitizeFilename('file:name.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file*name.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file?name.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file"name.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file<name>.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file|name.txt')).toBe('filename.txt');
    });

    it('should preserve safe special characters', () => {
      expect(sanitizeFilename('file@name.txt')).toBe('file@name.txt');
      expect(sanitizeFilename('file#tag.txt')).toBe('file#tag.txt');
      expect(sanitizeFilename('file$price.txt')).toBe('file$price.txt');
      expect(sanitizeFilename('file%percent.txt')).toBe('file%percent.txt');
      expect(sanitizeFilename('file^caret.txt')).toBe('file^caret.txt');
      expect(sanitizeFilename('file&more.txt')).toBe('file&more.txt');
    });

    it('should remove control characters including null bytes', () => {
      expect(sanitizeFilename('file\0name.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file\x01\x02\x03.txt')).toBe('file.txt');
    });

    it('should remove CRLF characters', () => {
      expect(sanitizeFilename('file\r\nname.txt')).toBe('filename.txt');
      expect(sanitizeFilename('file\nname.txt')).toBe('filename.txt');
    });
  });

  describe('Hidden files and leading dots', () => {
    it('should remove leading dots to prevent hidden files', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
      expect(sanitizeFilename('..hidden')).toBe('hidden');
      expect(sanitizeFilename('...hidden')).toBe('hidden');
    });

    it('should preserve dots in the middle and end of filename', () => {
      expect(sanitizeFilename('file.config.txt')).toBe('file.config.txt');
      expect(sanitizeFilename('archive.tar.gz')).toBe('archive.tar.gz');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty strings with fallback', () => {
      expect(sanitizeFilename('')).toBe('unnamed_file.txt');
    });

    it('should handle filenames with only dangerous characters', () => {
      expect(sanitizeFilename('///\\\\\\')).toBe('unnamed_file.txt');
      expect(sanitizeFilename('***???')).toBe('unnamed_file.txt');
    });

    it('should preserve filenames with safe special characters', () => {
      expect(sanitizeFilename('!@#$%^&*()')).toBe('!@#$%^&()');
    });

    it('should handle filenames with only dots', () => {
      expect(sanitizeFilename('...')).toBe('unnamed_file.txt');
      expect(sanitizeFilename('.')).toBe('unnamed_file.txt');
    });

    it('should handle whitespace-only filenames with fallback', () => {
      expect(sanitizeFilename('   ')).toBe('unnamed_file.txt');
    });

    it('should handle very long filenames with truncation', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('Real-world attack vectors', () => {
    it('should sanitize null byte injection', () => {
      expect(sanitizeFilename('file.txt\0.exe')).toBe('file.txt.exe');
    });

    it('should sanitize CRLF injection', () => {
      expect(sanitizeFilename('file\r\nname.txt')).toBe('filename.txt');
    });

    it('should preserve command characters (not dangerous in filenames)', () => {
      expect(sanitizeFilename('file; notes.txt')).toBe('file; notes.txt');
      expect(sanitizeFilename('file`backup`.txt')).toBe('file`backup`.txt');
    });

    it('should handle URL-encoded characters', () => {
      expect(sanitizeFilename('%2e%2e%2fpasswd')).toBe('%2e%2e%2fpasswd');
    });

    it('should handle Windows reserved filenames', () => {
      expect(sanitizeFilename('CON')).toBe('_CON');
      expect(sanitizeFilename('PRN.txt')).toBe('_PRN.txt');
      expect(sanitizeFilename('AUX')).toBe('_AUX');
      expect(sanitizeFilename('NUL.log')).toBe('_NUL.log');
      expect(sanitizeFilename('COM1')).toBe('_COM1');
      expect(sanitizeFilename('LPT1.txt')).toBe('_LPT1.txt');
    });
  });

  describe('File extension preservation', () => {
    it('should preserve common text file extensions', () => {
      expect(sanitizeFilename('doc.txt')).toBe('doc.txt');
      expect(sanitizeFilename('data.csv')).toBe('data.csv');
      expect(sanitizeFilename('subtitle.srt')).toBe('subtitle.srt');
    });

    it('should preserve extensions after dangerous character removal', () => {
      expect(sanitizeFilename('my:file.txt')).toBe('myfile.txt');
      expect(sanitizeFilename('path/to/file.csv')).toBe('pathtofile.csv');
    });

    it('should handle multiple extensions', () => {
      expect(sanitizeFilename('archive.tar.gz')).toBe('archive.tar.gz');
      expect(sanitizeFilename('backup.2024.txt')).toBe('backup.2024.txt');
    });

    it('should preserve extension when truncating long filenames', () => {
      const longName = 'a'.repeat(300);
      const result = sanitizeFilename(`${longName}.txt`);
      expect(result.endsWith('.txt')).toBe(true);
      expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(255);
    });
  });
});
