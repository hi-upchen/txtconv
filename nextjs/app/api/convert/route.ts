import { NextRequest } from 'next/server';
import { convertFile } from '@/lib/opencc';
import { readFileWithEncoding } from '@/lib/encoding';
import { validateFile } from '@/lib/file-validator';
import { archiveOriginalFile } from '@/lib/archive';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60s for Pro plan, 10s for Hobby

/**
 * POST /api/convert
 * Converts uploaded file from Simplified Chinese to Traditional Chinese using SSE
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const fileId = formData.get('fileId') as string;

        // Validate file
        const validation = validateFile(file!);
        if (!validation.valid) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                fileId,
                message: validation.error,
              })}\n\n`
            )
          );
          controller.close();
          return;
        }

        // Archive original file to Vercel Blob
        await archiveOriginalFile(file!);

        // Send start event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'progress',
              fileId,
              percent: 0,
              status: 'Reading file...',
            })}\n\n`
          )
        );

        // Read file with encoding detection
        const fileContent = await readFileWithEncoding(file!);

        // Send reading complete event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'progress',
              fileId,
              percent: 0.1,
              status: 'Converting...',
            })}\n\n`
          )
        );

        // Convert file with progress updates
        const convertedContent = await convertFile(fileContent, (percent) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'progress',
                fileId,
                percent: 0.1 + percent * 0.9, // 10% to 100%
                status: 'Converting...',
              })}\n\n`
            )
          );
        });

        // Generate output filename
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `${timestamp} ${file!.name}`;

        // Send completion event with converted content
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              fileId,
              percent: 1.0,
              fileName,
              content: convertedContent,
            })}\n\n`
          )
        );

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Conversion failed';

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              message: errorMessage,
            })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
