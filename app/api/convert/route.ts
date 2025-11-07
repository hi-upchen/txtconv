import { NextRequest } from 'next/server';
import { convertFile } from '@/lib/opencc';
import { readFileWithEncoding } from '@/lib/encoding';
import { validateFile } from '@/lib/file-validator';
import { archiveOriginalFile } from '@/lib/archive';
import { sanitizeFilename } from '@/lib/filename-sanitizer';
import jschardet from 'jschardet';

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
        const blobUrl = formData.get('blobUrl') as string | null;
        const originalFileName = formData.get('fileName') as string | null;
        let file = formData.get('file') as File | null;
        const fileId = formData.get('fileId') as string;

        // If blobUrl provided, fetch file from blob storage
        let blobArrayBuffer: ArrayBuffer | null = null;
        if (blobUrl) {
          try {
            const response = await fetch(blobUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch file from blob: ${response.status} ${response.statusText}`);
            }
            blobArrayBuffer = await response.arrayBuffer();
            file = new File([blobArrayBuffer], originalFileName || 'file.txt', { type: 'text/plain' });
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  fileId,
                  message: error instanceof Error ? error.message : 'Failed to fetch file from blob',
                })}\n\n`
              )
            );
            controller.close();
            return;
          }
        }

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

        // Archive original file to Vercel Blob (only if not already from blob)
        if (!blobUrl) {
          await archiveOriginalFile(file!);
        }

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
        // For blob-fetched files, use the ArrayBuffer directly to ensure proper encoding detection
        let fileContent: string;
        if (blobArrayBuffer) {
          // Use encoding detection for blob files to avoid UTF-8 corruption
          const buffer = Buffer.from(blobArrayBuffer);
          const sampleBuffer = buffer.slice(0, Math.min(500, buffer.length));

          // Detect encoding using jschardet
          const detected = jschardet.detect(sampleBuffer.toString('binary'));
          const encoding = detected.encoding || 'utf-8';

          // Decode with detected encoding
          try {
            const decoder = new TextDecoder(encoding);
            fileContent = decoder.decode(blobArrayBuffer);
          } catch {
            // Fallback to UTF-8 if detected encoding fails
            const decoder = new TextDecoder('utf-8');
            fileContent = decoder.decode(blobArrayBuffer);
          }
        } else {
          // For directly uploaded files, use existing encoding detection
          fileContent = await readFileWithEncoding(file!);
        }

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

        // Generate output filename with sanitization
        const fileName = sanitizeFilename(file!.name);

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
