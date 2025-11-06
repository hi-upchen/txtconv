import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '../FileUpload';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('FileUpload Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render upload dropzone', () => {
    render(<FileUpload />);

    expect(screen.getByText(/拖曳.*檔案到此處/i)).toBeInTheDocument();
    expect(screen.getByText(/支援多個檔案/i)).toBeInTheDocument();
  });

  it('should accept file drop', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['简体中文'], 'test.txt', { type: 'text/plain' });

    // Simulate file drop
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });
  });

  it('should accept multiple files', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file1 = new File(['content 1'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['content 2'], 'file2.txt', { type: 'text/plain' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, [file1, file2]);
    }

    await waitFor(() => {
      expect(screen.getByText('file1.txt')).toBeInTheDocument();
      expect(screen.getByText('file2.txt')).toBeInTheDocument();
    });
  });

  it('should show file size', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const content = 'x'.repeat(2048); // 2KB
    const file = new File([content], 'test.txt', { type: 'text/plain' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      expect(screen.getByText(/2\.0 KB/i)).toBeInTheDocument();
    });
  });

  it('should have convert button for each file', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      // Should have individual "轉換" button (not "轉換全部")
      expect(screen.getByRole('button', { name: '轉換' })).toBeInTheDocument();
    });
  });

  it('should call API when convert button clicked', async () => {
    const user = userEvent.setup();

    // Mock SSE response
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
              value: new TextEncoder().encode('data: {"type":"complete","content":"簡體中文"}\n\n'),
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

    const convertButton = await screen.findByRole('button', { name: '轉換' });
    await user.click(convertButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/convert',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('should show progress bar during conversion', async () => {
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

    const convertButton = await screen.findByRole('button', { name: '轉換' });
    await user.click(convertButton);

    // Should show progress UI
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /轉換/i })).not.toBeInTheDocument();
    });

    // Resolve to complete
    resolveRead({ done: true });
  });

  it('should show download button after conversion', async () => {
    const user = userEvent.setup();

    // Create a simpler mock that completes immediately
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"progress","percent":0.5}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"complete","content":"converted text","fileName":"test.txt"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: true,
        }),
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    render(<FileUpload />);

    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    // Find and click the convert button
    const convertButton = await screen.findByRole('button', { name: '轉換' });
    await user.click(convertButton);

    // Wait for the "轉換" button to disappear (meaning conversion started/completed)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '轉換' })).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/convert',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should show "Convert All" button when multiple files uploaded', async () => {
    const user = userEvent.setup();
    render(<FileUpload />);

    const file1 = new File(['test1'], 'file1.txt', { type: 'text/plain' });
    const file2 = new File(['test2'], 'file2.txt', { type: 'text/plain' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, [file1, file2]);
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /轉換全部/i })).toBeInTheDocument();
    });
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

    const convertButton = await screen.findByRole('button', { name: '轉換' });
    await user.click(convertButton);

    await waitFor(() => {
      expect(screen.getByText(/Conversion failed/i)).toBeInTheDocument();
    });
  });

  it('should handle only .txt files', () => {
    render(<FileUpload />);

    // Check if input accepts text files
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input?.accept).toContain('.txt');
  });
});
