/**
 * @jest-environment node
 */
import { POST } from '@/app/api/upload/route';
import { NextRequest } from 'next/server';
import { handleUpload } from '@vercel/blob/client';

// Mock Vercel Blob client
jest.mock('@vercel/blob/client', () => ({
  handleUpload: jest.fn(),
}));

describe('POST /api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createUploadRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  describe('Successful token generation', () => {
    it('should return upload token for valid request', async () => {
      const mockResponse = {
        url: 'https://blob.vercel-storage.com/test-file.txt',
        uploadUrl: 'https://blob.vercel-storage.com/upload',
        token: 'mock-upload-token',
      };

      (handleUpload as jest.Mock).mockResolvedValue(mockResponse);

      const requestBody = {
        pathname: 'test-file.txt',
        callbackUrl: '/api/upload',
        type: 'text/plain',
      };

      const request = createUploadRequest(requestBody);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual(mockResponse);
      expect(handleUpload).toHaveBeenCalledTimes(1);
    });

    it('should call onBeforeGenerateToken callback', async () => {
      const mockResponse = {
        url: 'https://blob.vercel-storage.com/test.csv',
        uploadUrl: 'https://blob.vercel-storage.com/upload',
        token: 'mock-token',
      };

      let capturedConfig: any;
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken, ...config }) => {
        // Capture the token generation callback
        if (onBeforeGenerateToken) {
          capturedConfig = await onBeforeGenerateToken('test.csv');
        }
        return mockResponse;
      });

      const requestBody = {
        pathname: 'test.csv',
        type: 'text/csv',
      };

      const request = createUploadRequest(requestBody);
      await POST(request);

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig.maximumSizeInBytes).toBe(25 * 1024 * 1024);
      expect(capturedConfig.addRandomSuffix).toBe(true);
    });

    it('should allow text/plain files', async () => {
      const mockResponse = { url: 'test', uploadUrl: 'test', token: 'test' };

      let allowedTypes: string[] = [];
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
        if (onBeforeGenerateToken) {
          const config = await onBeforeGenerateToken('test.txt');
          allowedTypes = config.allowedContentTypes || [];
        }
        return mockResponse;
      });

      const request = createUploadRequest({ pathname: 'test.txt', type: 'text/plain' });
      await POST(request);

      expect(allowedTypes).toContain('text/plain');
    });

    it('should allow text/csv files', async () => {
      const mockResponse = { url: 'test', uploadUrl: 'test', token: 'test' };

      let allowedTypes: string[] = [];
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
        if (onBeforeGenerateToken) {
          const config = await onBeforeGenerateToken('test.csv');
          allowedTypes = config.allowedContentTypes || [];
        }
        return mockResponse;
      });

      const request = createUploadRequest({ pathname: 'test.csv', type: 'text/csv' });
      await POST(request);

      expect(allowedTypes).toContain('text/csv');
    });

    it('should allow application/xml files', async () => {
      const mockResponse = { url: 'test', uploadUrl: 'test', token: 'test' };

      let allowedTypes: string[] = [];
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
        if (onBeforeGenerateToken) {
          const config = await onBeforeGenerateToken('test.xml');
          allowedTypes = config.allowedContentTypes || [];
        }
        return mockResponse;
      });

      const request = createUploadRequest({ pathname: 'test.xml', type: 'application/xml' });
      await POST(request);

      expect(allowedTypes).toContain('application/xml');
      expect(allowedTypes).toContain('text/xml');
    });

    it('should allow .srt subtitle files', async () => {
      const mockResponse = { url: 'test', uploadUrl: 'test', token: 'test' };

      let allowedTypes: string[] = [];
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
        if (onBeforeGenerateToken) {
          const config = await onBeforeGenerateToken('test.srt');
          allowedTypes = config.allowedContentTypes || [];
        }
        return mockResponse;
      });

      const request = createUploadRequest({ pathname: 'test.srt', type: 'application/x-subrip' });
      await POST(request);

      expect(allowedTypes).toContain('application/x-subrip');
    });
  });

  describe('File size validation', () => {
    it('should enforce 25MB maximum file size', async () => {
      const mockResponse = { url: 'test', uploadUrl: 'test', token: 'test' };

      let maxSize = 0;
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
        if (onBeforeGenerateToken) {
          const config = await onBeforeGenerateToken('large-file.txt');
          maxSize = config.maximumSizeInBytes || 0;
        }
        return mockResponse;
      });

      const request = createUploadRequest({ pathname: 'large-file.txt', type: 'text/plain' });
      await POST(request);

      expect(maxSize).toBe(25 * 1024 * 1024);
    });
  });

  describe('Error handling', () => {
    it('should return 400 for malformed JSON body', async () => {
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid-json',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('should handle handleUpload errors', async () => {
      (handleUpload as jest.Mock).mockRejectedValue(new Error('Blob storage unavailable'));

      const request = createUploadRequest({ pathname: 'test.txt', type: 'text/plain' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Blob storage unavailable');
    });

    it('should handle network errors gracefully', async () => {
      (handleUpload as jest.Mock).mockRejectedValue(new Error('Network timeout'));

      const request = createUploadRequest({ pathname: 'test.txt', type: 'text/plain' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Network timeout');
    });
  });

  describe('onUploadCompleted callback', () => {
    it('should call onUploadCompleted when upload succeeds', async () => {
      const mockBlob = {
        url: 'https://blob.vercel-storage.com/test-file.txt',
        pathname: 'test-file-abc123.txt',
        contentType: 'text/plain',
        contentDisposition: 'attachment; filename="test-file.txt"',
      };

      let uploadCompletedCalled = false;
      (handleUpload as jest.Mock).mockImplementation(async ({ onUploadCompleted }) => {
        if (onUploadCompleted) {
          await onUploadCompleted({ blob: mockBlob, tokenPayload: null });
          uploadCompletedCalled = true;
        }
        return { url: mockBlob.url, uploadUrl: 'test', token: 'test' };
      });

      const request = createUploadRequest({ pathname: 'test-file.txt', type: 'text/plain' });
      await POST(request);

      expect(uploadCompletedCalled).toBe(true);
    });
  });

  describe('Security and configuration', () => {
    it('should add random suffix to filenames for security', async () => {
      const mockResponse = { url: 'test', uploadUrl: 'test', token: 'test' };

      let addRandomSuffix = false;
      (handleUpload as jest.Mock).mockImplementation(async ({ onBeforeGenerateToken }) => {
        if (onBeforeGenerateToken) {
          const config = await onBeforeGenerateToken('test.txt');
          addRandomSuffix = config.addRandomSuffix || false;
        }
        return mockResponse;
      });

      const request = createUploadRequest({ pathname: 'test.txt', type: 'text/plain' });
      await POST(request);

      expect(addRandomSuffix).toBe(true);
    });

    it('should accept requests without authentication (public access)', async () => {
      const mockResponse = {
        url: 'https://blob.vercel-storage.com/test.txt',
        uploadUrl: 'https://blob.vercel-storage.com/upload',
        token: 'public-token',
      };

      (handleUpload as jest.Mock).mockResolvedValue(mockResponse);

      const request = createUploadRequest({ pathname: 'test.txt', type: 'text/plain' });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
