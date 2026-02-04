import { NextRequest } from 'next/server';
import { convertText, convertFileWithCustomDict } from '@/lib/opencc';
import { readFileWithEncoding } from '@/lib/encoding';
import { validateFile } from '@/lib/file-validator';
import { sanitizeFilename } from '@/lib/filename-sanitizer';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseDictionary, getDictPairLimit, type DictPair } from '@/lib/custom-dict';

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
        // Use unified encoding detection for all files (both blob-fetched and direct uploads)
        const { content: fileContent, encoding: inputEncoding } = await readFileWithEncoding(file!);

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

        // Fetch custom dictionary if user is authenticated
        let customPairs: DictPair[] = [];
        try {
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const serviceClient = createServiceClient();
            const { data: profile } = await serviceClient
              .from('profiles')
              .select('custom_dict_url, license_type')
              .eq('id', user.id)
              .single();

            if (profile?.custom_dict_url) {
              const dictResponse = await fetch(profile.custom_dict_url);
              if (dictResponse.ok) {
                const dictContent = await dictResponse.text();
                const allPairs = parseDictionary(dictContent);
                const limit = getDictPairLimit(profile.license_type);
                customPairs = allPairs.slice(0, limit);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching custom dictionary:', error);
        }

        // Convert file with progress updates (use custom dict if available)
        const convertedContent = await convertFileWithCustomDict(fileContent, customPairs, (percent) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'progress',
                fileId,
                percent: 0.1 + percent * 0.9,
                status: 'Converting...',
              })}\n\n`
            )
          );
        });

        // Generate output filename with translation and sanitization
        // Split filename and extension
        const originalName = file!.name;
        const lastDot = originalName.lastIndexOf('.');
        const nameWithoutExt = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
        const extension = lastDot > 0 ? originalName.slice(lastDot) : '';

        // Convert the filename (without extension) from simplified to traditional Chinese
        const convertedName = await convertText(nameWithoutExt);

        // Sanitize and recombine with extension
        const fileName = sanitizeFilename(convertedName + extension);

        // Send completion event with converted content
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              fileId,
              percent: 1.0,
              fileName,
              content: convertedContent,
              inputEncoding,
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
