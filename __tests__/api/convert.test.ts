/**
 * @jest-environment node
 */
import { POST } from '@/app/api/convert/route';
import { NextRequest } from 'next/server';

// Mock the OpenCC, encoding helpers, archive, and supabase
jest.mock('@/lib/opencc');
jest.mock('@/lib/encoding');
jest.mock('@/lib/archive');
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockRejectedValue(new Error('No request scope')),
  createServiceClient: jest.fn(),
}));

import { convertText, convertFileWithCustomDict } from '@/lib/opencc';
import { readFileWithEncoding } from '@/lib/encoding';
import { archiveOriginalFile } from '@/lib/archive';

// Mock global fetch
global.fetch = jest.fn();

describe('POST /api/convert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (archiveOriginalFile as jest.Mock).mockResolvedValue(undefined);
    // Default: convertText returns input as-is (for English text)
    (convertText as jest.Mock).mockImplementation(async (text: string) => text);
  });

  const createFormData = (content: string, filename: string = 'test.txt') => {
    const formData = new FormData();
    const file = new File([content], filename, { type: 'text/plain' });
    formData.append('file', file);
    formData.append('fileId', 'test-file-id');
    return formData;
  };

  const parseSSEStream = async (response: Response): Promise<any[]> => {
    const text = await response.text();
    const events: any[] = [];

    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        events.push(data);
      }
    }

    return events;
  };

  it('should return SSE response with correct headers', async () => {
    const formData = createFormData('简体中文');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockResolvedValue('简体中文');
    (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體中文');

    const response = await POST(request);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('should send progress events during conversion', async () => {
    const formData = createFormData('简体中文测试内容');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockResolvedValue('简体中文测试内容');
    (convertFileWithCustomDict as jest.Mock).mockImplementation(async (content, _pairs, callback) => {
      // Simulate progress callbacks
      if (callback) {
        callback(0.25);
        callback(0.5);
        callback(0.75);
        callback(1.0);
      }
      return '簡體中文測試內容';
    });

    const response = await POST(request);
    const events = await parseSSEStream(response);

    // Should have at least: start event, progress events, complete event
    expect(events.length).toBeGreaterThan(2);

    // Check for progress events
    const progressEvents = events.filter(e => e.type === 'progress');
    expect(progressEvents.length).toBeGreaterThan(0);

    // Check for complete event
    const completeEvent = events.find(e => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.fileId).toBe('test-file-id');
    expect(completeEvent.content).toBe('簡體中文測試內容');
  });

  it('should handle file reading errors', async () => {
    const formData = createFormData('test content');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockRejectedValue(new Error('Failed to read file'));

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('Failed to read file');
  });

  it('should handle conversion errors', async () => {
    const formData = createFormData('简体中文');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockResolvedValue('简体中文');
    (convertFileWithCustomDict as jest.Mock).mockRejectedValue(new Error('Conversion failed'));

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('Conversion failed');
  });

  it('should reject requests without file', async () => {
    const formData = new FormData();
    formData.append('fileId', 'test-file-id');

    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('No file provided');
  });

  it('should reject files larger than 25MB', async () => {
    // Create a 26MB file content
    const largeContent = 'x'.repeat(26 * 1024 * 1024);
    const formData = createFormData(largeContent);

    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('25MB');
  }, 10000);

  it('should include file metadata in events', async () => {
    const formData = createFormData('简体中文', 'my-file.txt');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockResolvedValue('简体中文');
    (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體中文');

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const completeEvent = events.find(e => e.type === 'complete');
    expect(completeEvent.fileId).toBe('test-file-id');
    expect(completeEvent.fileName).toBeDefined();
  });

  it('should reject empty files', async () => {
    const formData = createFormData('');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('File is empty');
  });

  describe('Blob URL support', () => {
    const createBlobFormData = (blobUrl: string, fileName: string = 'test.txt') => {
      const formData = new FormData();
      formData.append('blobUrl', blobUrl);
      formData.append('fileName', fileName);
      formData.append('fileId', 'test-file-id');
      return formData;
    };

    it('should accept blobUrl instead of file', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/test-file.txt';
      const fileContent = '简体中文';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(fileContent).buffer,
      });

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體中文');

      const formData = createBlobFormData(blobUrl, 'test.txt');
      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      expect(global.fetch).toHaveBeenCalledWith(blobUrl);
      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.content).toBe('簡體中文');
    });

    it('should handle blob fetch errors', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/test-file.txt';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const formData = createBlobFormData(blobUrl, 'test.txt');
      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.message).toContain('Failed to fetch file from blob');
    });

    it('should handle network errors when fetching blob', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/test-file.txt';

      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const formData = createBlobFormData(blobUrl, 'test.txt');
      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.message).toContain('Network error');
    });

    it('should validate file size from blob', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/large-file.txt';
      // Create 26MB content
      const largeContent = 'x'.repeat(26 * 1024 * 1024);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(largeContent).buffer,
      });

      const formData = createBlobFormData(blobUrl, 'large-file.txt');
      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.message).toContain('25MB');
    }, 10000);

    it('should preserve fileName from blobUrl request', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/test-file.txt';
      const fileContent = '简体中文';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(fileContent).buffer,
      });

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體中文');

      const formData = createBlobFormData(blobUrl, 'my-custom-file.txt');
      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.fileName).toContain('my-custom-file.txt');
    });

    it('should not call archiveOriginalFile when using blobUrl', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/test-file.txt';
      const fileContent = '简体中文';

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(fileContent).buffer,
      });

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體中文');

      const formData = createBlobFormData(blobUrl, 'test.txt');
      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      await POST(request);

      // Should not archive when file is already in blob
      expect(archiveOriginalFile).not.toHaveBeenCalled();
    });

    it('should reject request without blobUrl or file', async () => {
      const formData = new FormData();
      formData.append('fileId', 'test-file-id');

      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const errorEvent = events.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent.message).toContain('No file provided');
    });
  });

  describe('Filename translation', () => {
    it('should translate simplified Chinese filename to traditional', async () => {
      const fileContent = '简体中文内容';
      const file = new File([fileContent], '我的简体文档.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileId', 'test-file-id');

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體中文內容');
      // Mock convertText to translate the filename
      (convertText as jest.Mock).mockResolvedValue('我的簡體文檔');

      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      // Filename should be translated: 我的简体文档.txt → 我的簡體文檔.txt
      expect(completeEvent.fileName).toBe('我的簡體文檔.txt');
    });

    it('should preserve file extension during translation', async () => {
      const fileContent = '测试';
      const file = new File([fileContent], '简体文件名.csv', { type: 'text/csv' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileId', 'test-file-id');

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('測試');
      (convertText as jest.Mock).mockResolvedValue('簡體文件名');

      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.fileName).toBe('簡體文件名.csv');
    });

    it('should handle English filenames without translation', async () => {
      const fileContent = 'English content';
      const file = new File([fileContent], 'english-file.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileId', 'test-file-id');

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('English content');

      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.fileName).toBe('english-file.txt');
    });

    it('should handle filenames without extension', async () => {
      const fileContent = '简体';
      const file = new File([fileContent], '简体文件', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileId', 'test-file-id');

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('簡體');
      (convertText as jest.Mock).mockResolvedValue('簡體文件');

      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent.fileName).toBe('簡體文件');
    });

    it('should sanitize translated filename', async () => {
      const fileContent = '内容';
      // Filename with potentially dangerous characters
      const file = new File([fileContent], '我的<文档>.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileId', 'test-file-id');

      (readFileWithEncoding as jest.Mock).mockResolvedValue(fileContent);
      (convertFileWithCustomDict as jest.Mock).mockResolvedValue('內容');
      (convertText as jest.Mock).mockResolvedValue('我的<文檔>');

      const request = new NextRequest('http://localhost:3000/api/convert', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const events = await parseSSEStream(response);

      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      // < and > should be removed by sanitizer
      expect(completeEvent.fileName).toBe('我的文檔.txt');
    });
  });
});
