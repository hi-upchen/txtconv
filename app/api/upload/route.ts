import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/upload
 * Generates upload token for client-side direct upload to Vercel Blob
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname) => {
        // Allow text-based file types only
        return {
          allowedContentTypes: [
            'text/plain',
            'text/csv',
            'application/xml',
            'text/xml',
            'application/x-subrip', // .srt subtitle files
          ],
          maximumSizeInBytes: 25 * 1024 * 1024, // 25MB
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Optional: Log upload completion
        console.log('File uploaded to blob:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
