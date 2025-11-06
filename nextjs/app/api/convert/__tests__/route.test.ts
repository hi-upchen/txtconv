/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock the OpenCC and encoding helpers
jest.mock('@/lib/opencc');
jest.mock('@/lib/encoding');

import { convertFile } from '@/lib/opencc';
import { readFileWithEncoding } from '@/lib/encoding';

describe('POST /api/convert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    (convertFile as jest.Mock).mockResolvedValue('簡體中文');

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
    (convertFile as jest.Mock).mockImplementation(async (content, callback) => {
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
    (convertFile as jest.Mock).mockRejectedValue(new Error('Conversion failed'));

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

  it('should reject files larger than 4MB', async () => {
    // Create a 5MB file content
    const largeContent = 'x'.repeat(5 * 1024 * 1024);
    const formData = createFormData(largeContent);

    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const errorEvent = events.find(e => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('4MB');
  });

  it('should include file metadata in events', async () => {
    const formData = createFormData('简体中文', 'my-file.txt');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockResolvedValue('简体中文');
    (convertFile as jest.Mock).mockResolvedValue('簡體中文');

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const completeEvent = events.find(e => e.type === 'complete');
    expect(completeEvent.fileId).toBe('test-file-id');
    expect(completeEvent.fileName).toBeDefined();
  });

  it('should handle empty files', async () => {
    const formData = createFormData('');
    const request = new NextRequest('http://localhost:3000/api/convert', {
      method: 'POST',
      body: formData,
    });

    (readFileWithEncoding as jest.Mock).mockResolvedValue('');
    (convertFile as jest.Mock).mockResolvedValue('');

    const response = await POST(request);
    const events = await parseSSEStream(response);

    const completeEvent = events.find(e => e.type === 'complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.content).toBe('');
  });
});
