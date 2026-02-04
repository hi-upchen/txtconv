import { list, del } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for cron job

const RETENTION_DAYS = 3;
const DELETE_BATCH_SIZE = 1000; // Delete 1000 at a time
const DELAY_BETWEEN_BATCHES_MS = 5000; // 5 seconds delay between batches
const RATE_LIMIT_RETRY_MS = 30000; // 30 seconds retry delay on rate limit
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Too many requests');
}

async function delWithRetry(urls: string[]): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await del(urls);
      return;
    } catch (error) {
      if (isRateLimitError(error) && attempt < MAX_RETRIES) {
        console.log(`Rate limited, waiting 30 seconds before retry (attempt ${attempt}/${MAX_RETRIES})...`);
        await delay(RATE_LIMIT_RETRY_MS);
      } else {
        throw error;
      }
    }
  }
}

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
    let pageNum = 0;
    do {
      pageNum++;
      const result = await list({ cursor, limit: 1000 });
      console.log(`Scanning page ${pageNum}: ${result.blobs.length} blobs found`);

      // Collect URLs to delete in this batch
      const urlsToDelete: string[] = [];
      for (const blob of result.blobs) {
        // Skip dictionary files
        if (blob.pathname.startsWith('dictionaries/')) {
          continue;
        }

        // Mark for deletion if older than retention period
        if (new Date(blob.uploadedAt) < cutoffDate) {
          urlsToDelete.push(blob.url);
        }
      }

      // Delete in small batches with delays to avoid rate limiting
      if (urlsToDelete.length > 0) {
        console.log(`Going to delete ${urlsToDelete.length} files from page ${pageNum}`);
      }
      for (let i = 0; i < urlsToDelete.length; i += DELETE_BATCH_SIZE) {
        const batch = urlsToDelete.slice(i, i + DELETE_BATCH_SIZE);
        const batchNum = Math.floor(i / DELETE_BATCH_SIZE) + 1;
        console.log(`Deleting batch ${batchNum}: ${batch.length} files...`);
        await delWithRetry(batch);
        deletedCount += batch.length;
        console.log(`Finished batch ${batchNum}: deleted ${batch.length} files (total: ${deletedCount})`);

        // Delay between batches to avoid rate limiting
        if (i + DELETE_BATCH_SIZE < urlsToDelete.length) {
          await delay(DELAY_BETWEEN_BATCHES_MS);
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
