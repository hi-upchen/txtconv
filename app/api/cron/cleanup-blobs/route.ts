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
