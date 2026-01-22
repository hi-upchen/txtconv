import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '@/components/FileUpload';
import { upload } from '@vercel/blob/client';

// Mock Vercel Blob client
jest.mock('@vercel/blob/client', () => ({
  upload: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob://mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document.createElement for auto-download
const mockClick = jest.fn();
const originalCreateElement = document.createElement.bind(document);
document.createElement = jest.fn((tagName) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'a') {
    element.click = mockClick;
  }
  return element;
});

describe('FileUpload Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    (upload as jest.Mock).mockClear();
    mockClick.mockClear();
  });

  it('should render upload dropzone with original text', () => {
    render(<FileUpload />);

    expect(screen.getByText(/上傳檔案，支援 txt, csv, srt/i)).toBeInTheDocument();
  });

  it('should accept file drop and auto-convert', async () => {
    const user = userEvent.setup();

    // Mock blob upload
    (upload as jest.Mock).mockImplementation(async (fileName, file, options) => {
      // Simulate progress callback
      if (options?.onUploadProgress) {
        options.onUploadProgress({ percentage: 50 });
        options.onUploadProgress({ percentage: 100 });
      }
      return {
        url: 'https://blob.vercel-storage.com/test-file.txt',
        pathname: 'test-file-abc123.txt',
      };
    });

    // Mock successful conversion
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"progress","percent":0.5}\n\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"complete","content":"converted","fileName":"test.txt"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    });

    render(<FileUpload />);

    const file = new File(['简体中文'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    // Should show filename
    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    // Should call upload to Vercel Blob
    await waitFor(() => {
      expect(upload).toHaveBeenCalled();
    });

    // Should call convert API with blobUrl
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/convert',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('should accept multiple files', async () => {
    const user = userEvent.setup();

    // Mock blob upload
    (upload as jest.Mock).mockResolvedValue({
      url: 'https://blob.vercel-storage.com/file.txt',
      pathname: 'file-abc123.txt',
    });

    // Mock conversions - return distinct filenames for each file
    let callCount = 0;
    (global.fetch as jest.Mock).mockImplementation(() => {
      callCount++;
      const fileName = `converted-file${callCount}.txt`;
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode(`data: {"type":"complete","content":"converted","fileName":"${fileName}"}\n\n`),
              })
              .mockResolvedValueOnce({
                done: true,
              }),
          }),
        },
      };
    });

    render(<FileUpload />);

    const file1 = new File(['content 1'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['content 2'], 'file2.txt', { type: 'text/plain' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, [file1, file2]);
    }

    // Wait for both files to show up with converted filenames
    await waitFor(() => {
      expect(screen.getByText('converted-file1.txt')).toBeInTheDocument();
      expect(screen.getByText('converted-file2.txt')).toBeInTheDocument();
    });
  });

  it('should show progress during upload', async () => {
    const user = userEvent.setup();

    // Mock blob upload with delay
    (upload as jest.Mock).mockImplementation(async (fileName, file, options) => {
      if (options?.onUploadProgress) {
        options.onUploadProgress({ percentage: 50 });
      }
      return {
        url: 'https://blob.vercel-storage.com/file.txt',
        pathname: 'file-abc123.txt',
      };
    });

    let resolveRead: any;
    const readPromise = new Promise((resolve) => {
      resolveRead = resolve;
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn().mockReturnValue(readPromise),
        }),
      },
    });

    render(<FileUpload />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    // Should show filename
    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    // Resolve to complete
    resolveRead({ done: true });
  });

  it('should show download button after conversion', async () => {
    const user = userEvent.setup();

    // Mock blob upload
    (upload as jest.Mock).mockResolvedValue({
      url: 'https://blob.vercel-storage.com/file.txt',
      pathname: 'file-abc123.txt',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"complete","content":"converted text","fileName":"2025-01-01 test.txt"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    });

    render(<FileUpload />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    // Wait for conversion to complete and show "Finished" status
    await waitFor(() => {
      expect(screen.getByText('Finished')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Should have a download button
    await waitFor(() => {
      expect(screen.getByText('download')).toBeInTheDocument();
    });
  });

  it('should show error message on conversion failure', async () => {
    const user = userEvent.setup();

    // Mock blob upload
    (upload as jest.Mock).mockResolvedValue({
      url: 'https://blob.vercel-storage.com/file.txt',
      pathname: 'file-abc123.txt',
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"error","message":"Conversion failed"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    });

    render(<FileUpload />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    // Should show "Failed" status
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    // Should have retry button
    await waitFor(() => {
      expect(screen.getByText('refresh')).toBeInTheDocument();
    });
  });
});
