import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '@/components/FileUpload';

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
    mockClick.mockClear();
  });

  it('should render upload dropzone with original text', () => {
    render(<FileUpload />);

    expect(screen.getByText(/上傳檔案，支援 txt, csv, srt/i)).toBeInTheDocument();
  });

  it('should accept file drop and auto-convert', async () => {
    const user = userEvent.setup();

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

    // Should auto-convert and call API
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

    // Mock conversions
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"type":"complete","content":"converted","fileName":"file.txt"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    });

    render(<FileUpload />);

    const file1 = new File(['content 1'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['content 2'], 'file2.txt', { type: 'text/plain' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, [file1, file2]);
    }

    // Wait for both files to be processed (check for 2 file rows)
    await waitFor(() => {
      const fileRows = document.querySelectorAll('.file-row');
      expect(fileRows.length).toBe(2);
    });
  });

  it('should show file size in human readable format', async () => {
    const user = userEvent.setup();

    // Mock conversion
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: jest.fn().mockResolvedValue({ done: true }),
        }),
      },
    });

    render(<FileUpload />);

    const content = 'x'.repeat(2048); // 2KB
    const file = new File([content], 'test.txt', { type: 'text/plain' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      expect(screen.getByText(/2\.0 kB/i)).toBeInTheDocument();
    });
  });

  it('should show progress during conversion', async () => {
    const user = userEvent.setup();

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

    // Should show progress indicator
    await waitFor(() => {
      expect(screen.getByText('轉換中')).toBeInTheDocument();
    });

    // Resolve to complete
    resolveRead({ done: true });
  });

  it('should show download link after conversion', async () => {
    const user = userEvent.setup();

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

    // Wait for conversion to complete and show download icon
    await waitFor(() => {
      const downloadIcon = document.querySelector('.fa-download');
      expect(downloadIcon).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show error message on conversion failure', async () => {
    const user = userEvent.setup();

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

    await waitFor(() => {
      expect(screen.getByText(/Conversion failed/i)).toBeInTheDocument();
    });
  });
});
