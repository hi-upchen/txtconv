import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '@/components/FileUpload';
import * as clientConverter from '@/lib/client-converter';

// Mock client-converter module
jest.mock('@/lib/client-converter', () => ({
  convertFile: jest.fn(),
  areLibsLoaded: jest.fn(() => false),
  loadConverterLibs: jest.fn(),
  clearDictCache: jest.fn(),
  isEpubFile: jest.fn((name: string) => name.toLowerCase().endsWith('.epub')),
}));

// Mock fetch for API calls (still needed for auth/profile)
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

/**
 * Payment page the upgrade dialog links to. Computed exactly like the
 * component does, so the assertion holds both locally (where .env supplies
 * the real product URL) and in continuous integration (where it does not).
 */
const EXPECTED_GUMROAD_URL = process.env.NEXT_PUBLIC_GUMROAD_URL || 'https://gumroad.com';

describe('FileUpload Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    mockClick.mockClear();
    (clientConverter.convertFile as jest.Mock).mockClear();
    // Reset the GTM dataLayer so each test asserts only its own events
    window.dataLayer = [];
    // The upgrade dialog opens by itself only once per browser session and
    // records that in sessionStorage, which jsdom keeps across tests in a
    // file. Clearing it gives every test a fresh session.
    window.sessionStorage.clear();
  });

  it('should render upload dropzone with original text', () => {
    render(<FileUpload />);

    expect(screen.getByText(/上傳檔案，支援 txt, epub, csv, srt/i)).toBeInTheDocument();
  });

  it('should accept file drop and auto-convert', async () => {
    const user = userEvent.setup();

    // Mock client-side conversion
    (clientConverter.convertFile as jest.Mock).mockImplementation(async (file, userId, onProgress) => {
      onProgress({ stage: 'loading-libs', percent: 0.1 });
      onProgress({ stage: 'converting', percent: 0.5, currentLine: 50, totalLines: 100 });
      onProgress({ stage: 'complete', percent: 1 });
      return {
        content: 'converted text',
        fileName: 'test.txt',
        encoding: 'UTF-8',
      };
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

    // Should call client-side converter
    await waitFor(() => {
      expect(clientConverter.convertFile).toHaveBeenCalled();
    });
  });

  it('should accept multiple files', async () => {
    const user = userEvent.setup();

    // Mock client-side conversions - return distinct filenames for each file
    let callCount = 0;
    (clientConverter.convertFile as jest.Mock).mockImplementation(async (file, userId, onProgress) => {
      callCount++;
      onProgress({ stage: 'complete', percent: 1 });
      return {
        content: 'converted text',
        fileName: `converted-file${callCount}.txt`,
        encoding: 'UTF-8',
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

  it('should show progress during conversion', async () => {
    const user = userEvent.setup();

    let resolveConversion: any;
    const conversionPromise = new Promise((resolve) => {
      resolveConversion = resolve;
    });

    // Mock client-side conversion that will wait
    (clientConverter.convertFile as jest.Mock).mockImplementation(async (file, userId, onProgress) => {
      onProgress({ stage: 'loading-libs', percent: 0.1 });
      onProgress({ stage: 'converting', percent: 0.5, currentLine: 50, totalLines: 100 });
      await conversionPromise;
      return {
        content: 'converted text',
        fileName: 'test.txt',
        encoding: 'UTF-8',
      };
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

    // Resolve conversion to complete
    resolveConversion();
  });

  it('should show download button after conversion', async () => {
    const user = userEvent.setup();

    // Mock client-side conversion
    (clientConverter.convertFile as jest.Mock).mockImplementation(async (file, userId, onProgress) => {
      onProgress({ stage: 'loading-libs', percent: 0.1 });
      onProgress({ stage: 'converting', percent: 0.5 });
      onProgress({ stage: 'complete', percent: 1 });
      return {
        content: 'converted text',
        fileName: '2025-01-01 test.txt',
        encoding: 'UTF-8',
      };
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

    // Mock client-side conversion failure
    (clientConverter.convertFile as jest.Mock).mockRejectedValue(new Error('Conversion failed'));

    render(<FileUpload />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
    }

    // Should show the actual error message (more useful than a bare "Failed" label)
    await waitFor(() => {
      expect(screen.getByText('Conversion failed')).toBeInTheDocument();
    });

    // Should have retry button
    await waitFor(() => {
      expect(screen.getByText('refresh')).toBeInTheDocument();
    });
  });

  it('should reject files over the free 5MB limit with an upgrade button', async () => {
    const user = userEvent.setup();

    render(<FileUpload licenseType="free" />);

    const file = new File(['x'], 'novel.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      expect(screen.getByText(/檔案 10.00MB 超過免費版 5MB 上限/)).toBeInTheDocument();
    });
    // The row offers a button (not an anchor to a homepage-only "#pricing"
    // fragment, which did nothing on the landing pages)
    expect(
      screen.getByRole('button', { name: /升級 Pro 可轉換 100MB/ })
    ).toBeInTheDocument();
    // Rejected file must never start converting
    expect(clientConverter.convertFile).not.toHaveBeenCalled();
  });

  /** Uploads a file whose size exceeds the free tier's 5MB limit. */
  async function dropOversizedFile(
    user: ReturnType<typeof userEvent.setup>,
    name = 'novel.txt',
    sizeBytes = 9 * 1024 * 1024
  ) {
    const file = new File(['x'], name, { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: sizeBytes });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);
  }

  it('should open the upgrade dialog when an oversized file is dropped', async () => {
    const user = userEvent.setup();

    render(<FileUpload licenseType="free" />);
    await dropOversizedFile(user);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      screen.getByRole('heading', { name: '檔案超過免費版 5MB 上限' })
    ).toBeInTheDocument();
    // Body copy names the rejected file and its size
    expect(screen.getByText(/「novel.txt」大小為 9.00MB/)).toBeInTheDocument();

    // The buy button is a real link to the configured payment page
    expect(
      screen.getByRole('link', { name: /升級 Pro 終身版 US\$30/ })
    ).toHaveAttribute('href', EXPECTED_GUMROAD_URL);
  });

  it('should close the upgrade dialog when dismissed', async () => {
    const user = userEvent.setup();

    render(<FileUpload licenseType="free" />);
    await dropOversizedFile(user);

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: '稍後再說' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('should not reopen the upgrade dialog automatically later in the same session', async () => {
    const user = userEvent.setup();

    render(<FileUpload licenseType="free" />);
    await dropOversizedFile(user, 'first.txt');

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: '稍後再說' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // A second oversized file is still rejected, but must not interrupt again
    await dropOversizedFile(user, 'second.txt');

    await waitFor(() => {
      expect(screen.getByText('second.txt')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should reopen the upgrade dialog from the rejected row button', async () => {
    const user = userEvent.setup();

    render(<FileUpload licenseType="free" />);
    await dropOversizedFile(user);

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: '稍後再說' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // The once-per-session cap applies to automatic opening only; an explicit
    // click must always bring the offer back
    await user.click(screen.getByRole('button', { name: /升級 Pro 可轉換 100MB/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('should push a file_rejected dataLayer event on an oversized drop', async () => {
    const user = userEvent.setup();

    render(<FileUpload licenseType="free" />);

    const file = new File(['x'], 'novel.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 9 * 1024 * 1024 });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      expect(screen.getByText(/檔案 9.00MB 超過免費版 5MB 上限/)).toBeInTheDocument();
    });

    const rejectedEvents = window.dataLayer.filter((e) => e.event === 'file_rejected');
    expect(rejectedEvents).toHaveLength(1);
    expect(rejectedEvents[0]).toMatchObject({
      event: 'file_rejected',
      file_size: 9 * 1024 * 1024,
      file_type: '.txt',
      reject_reason: 'size_limit_free',
      upgrade_available: true,
      source_path: '/',
    });
  });

  it('should accept a 10MB file for lifetime users', async () => {
    const user = userEvent.setup();

    (clientConverter.convertFile as jest.Mock).mockResolvedValue({
      content: '轉換後內容',
      fileName: 'novel.txt',
      encoding: 'UTF8',
    });

    render(<FileUpload licenseType="lifetime" />);

    const file = new File(['x'], 'novel.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (input) {
      await user.upload(input, file);
    }

    await waitFor(() => {
      expect(clientConverter.convertFile).toHaveBeenCalled();
    });
  });
});
