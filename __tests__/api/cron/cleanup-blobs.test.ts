/**
 * @jest-environment node
 */
import { GET } from '@/app/api/cron/cleanup-blobs/route';
import { list, del } from '@vercel/blob';

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  list: jest.fn(),
  del: jest.fn(),
}));

const mockList = list as jest.MockedFunction<typeof list>;
const mockDel = del as jest.MockedFunction<typeof del>;

describe('GET /api/cron/cleanup-blobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set CRON_SECRET for tests
    process.env.CRON_SECRET = 'test-secret';
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('rejects requests without valid CRON_SECRET', async () => {
    const request = new Request('http://localhost/api/cron/cleanup-blobs', {
      headers: {},
    });

    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('accepts requests with valid CRON_SECRET', async () => {
    mockList.mockResolvedValueOnce({
      blobs: [],
      hasMore: false,
      cursor: undefined,
    } as any);

    const request = new Request('http://localhost/api/cron/cleanup-blobs', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('deletes blobs older than 3 days', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

    mockList.mockResolvedValueOnce({
      blobs: [
        { url: 'https://blob.vercel-storage.com/old-file.txt', pathname: 'old-file.txt', uploadedAt: fourDaysAgo },
        { url: 'https://blob.vercel-storage.com/new-file.txt', pathname: 'new-file.txt', uploadedAt: oneDayAgo },
      ],
      hasMore: false,
      cursor: undefined,
    } as any);

    mockDel.mockResolvedValueOnce(undefined);

    const request = new Request('http://localhost/api/cron/cleanup-blobs', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith('https://blob.vercel-storage.com/old-file.txt');
    expect(data.deleted).toBe(1);
  });

  it('excludes dictionary files from deletion', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    mockList.mockResolvedValueOnce({
      blobs: [
        { url: 'https://blob.vercel-storage.com/old-file.txt', pathname: 'old-file.txt', uploadedAt: fourDaysAgo },
        { url: 'https://blob.vercel-storage.com/dictionaries/user-123.csv', pathname: 'dictionaries/user-123.csv', uploadedAt: fourDaysAgo },
      ],
      hasMore: false,
      cursor: undefined,
    } as any);

    mockDel.mockResolvedValueOnce(undefined);

    const request = new Request('http://localhost/api/cron/cleanup-blobs', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockDel).toHaveBeenCalledTimes(1);
    expect(mockDel).toHaveBeenCalledWith('https://blob.vercel-storage.com/old-file.txt');
    expect(data.deleted).toBe(1);
  });

  it('handles pagination when listing blobs', async () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    // First page
    mockList.mockResolvedValueOnce({
      blobs: [
        { url: 'https://blob.vercel-storage.com/file1.txt', pathname: 'file1.txt', uploadedAt: fourDaysAgo },
      ],
      hasMore: true,
      cursor: 'cursor-1',
    } as any);

    // Second page
    mockList.mockResolvedValueOnce({
      blobs: [
        { url: 'https://blob.vercel-storage.com/file2.txt', pathname: 'file2.txt', uploadedAt: fourDaysAgo },
      ],
      hasMore: false,
      cursor: undefined,
    } as any);

    mockDel.mockResolvedValue(undefined);

    const request = new Request('http://localhost/api/cron/cleanup-blobs', {
      headers: { Authorization: 'Bearer test-secret' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockDel).toHaveBeenCalledTimes(2);
    expect(data.deleted).toBe(2);
  });
});
