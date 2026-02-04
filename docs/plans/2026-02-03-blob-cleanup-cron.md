# Blob Cleanup Cron Job Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a Vercel cron job that deletes blob files older than 3 days, excluding dictionary files.

**Architecture:** A single API route triggered by Vercel's cron scheduler at 3am UTC daily. The route lists all blobs, filters by age and path, and deletes matching files. Security via CRON_SECRET header verification.

**Tech Stack:** Next.js API routes, @vercel/blob (list, del), Vercel cron configuration

---

### Task 1: Create vercel.json with Cron Configuration

**Files:**
- Create: `vercel.json`

**Step 1: Create the vercel.json file**

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-blobs",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Step 2: Verify JSON is valid**

Run: `cat vercel.json | python3 -m json.tool`
Expected: Pretty-printed JSON without errors

**Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add vercel cron configuration for blob cleanup"
```

---

### Task 2: Write Tests for Cleanup Endpoint

**Files:**
- Create: `__tests__/api/cron/cleanup-blobs.test.ts`

**Step 1: Write the test file**

```typescript
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
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --watchAll=false __tests__/api/cron/cleanup-blobs.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/cron/cleanup-blobs/route'"

**Step 3: Commit test file**

```bash
git add __tests__/api/cron/cleanup-blobs.test.ts
git commit -m "test: add tests for blob cleanup cron endpoint"
```

---

### Task 3: Implement Cleanup Endpoint

**Files:**
- Create: `app/api/cron/cleanup-blobs/route.ts`

**Step 1: Create the cleanup route**

```typescript
import { list, del } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RETENTION_DAYS = 3;

/**
 * GET /api/cron/cleanup-blobs
 * Deletes blob files older than RETENTION_DAYS, excluding dictionary files.
 * Protected by CRON_SECRET - only Vercel's cron scheduler should call this.
 */
export async function GET(request: Request): Promise<Response> {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    let cursor: string | undefined;

    // Paginate through all blobs
    do {
      const result = await list({ cursor, limit: 1000 });

      for (const blob of result.blobs) {
        // Skip dictionary files
        if (blob.pathname.startsWith('dictionaries/')) {
          continue;
        }

        // Delete if older than retention period
        if (new Date(blob.uploadedAt) < cutoffDate) {
          await del(blob.url);
          deletedCount++;
        }
      }

      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    console.log(`Blob cleanup: deleted ${deletedCount} files`);

    return Response.json({
      success: true,
      deleted: deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error('Blob cleanup error:', error);
    return Response.json(
      { error: 'Cleanup failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --watchAll=false __tests__/api/cron/cleanup-blobs.test.ts`
Expected: PASS (5 tests)

**Step 3: Run all tests to ensure no regressions**

Run: `npm test -- --watchAll=false`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/api/cron/cleanup-blobs/route.ts
git commit -m "feat: implement blob cleanup cron endpoint"
```

---

### Task 4: Remove Dead Archive Code

**Files:**
- Delete: `lib/archive.ts`
- Modify: `app/api/convert/route.ts:5,70-73`

**Step 1: Remove archive import and call from convert route**

In `app/api/convert/route.ts`, remove line 5:
```typescript
import { archiveOriginalFile } from '@/lib/archive';
```

And remove lines 70-73:
```typescript
        // Archive original file to Vercel Blob (only if not already from blob)
        if (!blobUrl) {
          await archiveOriginalFile(file!);
        }
```

**Step 2: Delete lib/archive.ts**

Run: `rm lib/archive.ts`

**Step 3: Run tests to verify convert still works**

Run: `npm test -- --watchAll=false __tests__/api/convert.test.ts`
Expected: PASS

**Step 4: Run all tests**

Run: `npm test -- --watchAll=false`
Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove dead archive code

- archiveOriginalFile was never called (UI always provides blobUrl)
- Simplifies convert route
"
```

---

### Task 5: Final Verification

**Step 1: Run full test suite**

Run: `npm test -- --watchAll=false`
Expected: All tests pass (should be ~151 tests now)

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Review changes**

Run: `git log --oneline -5`
Expected: 4 commits for this feature

Run: `git diff master --stat`
Expected: Shows files changed (vercel.json, cleanup route, tests, removed archive.ts)

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Create vercel.json with cron config | N/A |
| 2 | Write tests for cleanup endpoint | 5 tests |
| 3 | Implement cleanup endpoint | Tests pass |
| 4 | Remove dead archive code | Existing tests pass |
| 5 | Final verification | All tests pass |
