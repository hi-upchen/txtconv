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
  });

  describe('Path traversal attacks', () => {
    it('should sanitize path traversal attempts', () => {
      expect(sanitizeFilename('../../../etc/passwd')).toBe('___etc_passwd');
      expect(sanitizeFilename('../../config.txt')).toBe('__config.txt');
    });

    it('should remove forward slashes', () => {
      expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
      expect(sanitizeFilename('/etc/passwd')).toBe('_etc_passwd');
    });

    it('should remove backslashes', () => {
      expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
      expect(sanitizeFilename('C:\\Windows\\System32\\config.sys')).toBe('C__Windows_System32_config.sys');
    });

    it('should handle mixed path separators', () => {
      expect(sanitizeFilename('../path\\to/file.txt')).toBe('_path_to_file.txt');
    });
  });

  describe('Special characters', () => {
    it('should replace special characters with underscores', () => {
      expect(sanitizeFilename('file@#$%^&*.txt')).toBe('file_______.txt');
      expect(sanitizeFilename('document!?.txt')).toBe('document__.txt');
    });

    it('should remove null bytes', () => {
      expect(sanitizeFilename('file\0.txt')).toBe('file_.txt');
    });

    it('should handle unicode characters', () => {
      expect(sanitizeFilename('文件.txt')).toBe('__.txt');
      expect(sanitizeFilename('file-简体中文.txt')).toBe('file-____.txt');
    });

    it('should handle emoji and symbols', () => {
      // Emoji characters become multiple underscores (multi-byte)
      expect(sanitizeFilename('file😀.txt')).toBe('file__.txt');
      expect(sanitizeFilename('report™.txt')).toBe('report_.txt');
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

    it('should handle filenames with only special characters', () => {
      expect(sanitizeFilename('!@#$%^&*()')).toBe('unnamed_file.txt');
    });

    it('should handle filenames with only dots', () => {
      expect(sanitizeFilename('...')).toBe('unnamed_file.txt');
      expect(sanitizeFilename('.')).toBe('unnamed_file.txt');
    });

    it('should handle whitespace-only filenames with fallback', () => {
      // Whitespace-only is considered invalid and gets fallback
      expect(sanitizeFilename('   ')).toBe('unnamed_file.txt');
    });

    it('should handle very long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFilename(longName);
      expect(result).toBe(longName); // No truncation in current implementation
    });
  });

  describe('Real-world attack vectors', () => {
    it('should sanitize null byte injection', () => {
      expect(sanitizeFilename('file.txt\0.exe')).toBe('file.txt_.exe');
    });

    it('should sanitize CRLF injection', () => {
      expect(sanitizeFilename('file\r\n.txt')).toBe('file__.txt');
    });

    it('should sanitize command injection attempts', () => {
      expect(sanitizeFilename('file; rm -rf /')).toBe('file_ rm -rf _');
      expect(sanitizeFilename('file`whoami`.txt')).toBe('file_whoami_.txt');
    });

    it('should sanitize directory traversal with encoded characters', () => {
      expect(sanitizeFilename('%2e%2e%2f%2e%2e%2fpasswd')).toBe('_2e_2e_2f_2e_2e_2fpasswd');
    });
  });

  describe('File extension preservation', () => {
    it('should preserve common text file extensions', () => {
      expect(sanitizeFilename('doc.txt')).toBe('doc.txt');
      expect(sanitizeFilename('data.csv')).toBe('data.csv');
      expect(sanitizeFilename('subtitle.srt')).toBe('subtitle.srt');
    });

    it('should preserve extensions after sanitization', () => {
      expect(sanitizeFilename('my@file!.txt')).toBe('my_file_.txt');
      expect(sanitizeFilename('path/to/file.csv')).toBe('path_to_file.csv');
    });

    it('should handle multiple extensions', () => {
      expect(sanitizeFilename('archive.tar.gz')).toBe('archive.tar.gz');
      expect(sanitizeFilename('backup.2024.txt')).toBe('backup.2024.txt');
    });
  });
});
