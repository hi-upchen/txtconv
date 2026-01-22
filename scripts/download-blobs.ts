import 'dotenv/config';
import { list } from '@vercel/blob';
import * as fs from 'fs';
import * as path from 'path';

// Token priority: CLI arg > BLOB_READ_WRITE_TOKEN_PROD > BLOB_READ_WRITE_TOKEN
const CLI_TOKEN = process.argv[2];
const BLOB_TOKEN = CLI_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_PROD || process.env.BLOB_READ_WRITE_TOKEN;

const SIZE_BUCKETS = [
  { name: 'XS', max: 10 * 1024 },           // < 10KB
  { name: 'S', max: 500 * 1024 },           // < 500KB
  { name: 'M', max: 1 * 1024 * 1024 },      // < 1MB
  { name: 'L', max: 5 * 1024 * 1024 },      // < 5MB
  { name: 'XL', max: 10 * 1024 * 1024 },    // < 10MB
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBucket(size: number): string {
  for (const bucket of SIZE_BUCKETS) {
    if (size < bucket.max) return bucket.name;
  }
  return 'XXL';
}

function getExtension(pathname: string): string {
  const ext = path.extname(pathname).toLowerCase();
  return ext || 'unknown';
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface BlobInfo {
  url: string;
  pathname: string;
  size: number;
  bucket: string;
  extension: string;
  uploadedAt: Date;
}

const MAX_BLOBS = 5000;

async function fetchAllBlobs(): Promise<BlobInfo[]> {
  const blobs: BlobInfo[] = [];
  let cursor: string | undefined;
  let page = 0;

  do {
    page++;
    process.stdout.write(`\rFetching page ${page}... (${blobs.length} blobs so far)`);

    const response = await list({ cursor, token: BLOB_TOKEN, limit: 1000 });
    for (const blob of response.blobs) {
      if (blobs.length >= MAX_BLOBS) break;
      blobs.push({
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        bucket: getBucket(blob.size),
        extension: getExtension(blob.pathname),
        uploadedAt: blob.uploadedAt,
      });
    }
    cursor = response.cursor;
  } while (cursor && blobs.length < MAX_BLOBS);

  // Sort by date, newest first
  blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

  process.stdout.write(`\rFetched ${page} page(s), ${blobs.length} blobs total.      \n`);
  return blobs;
}

function selectVariety(blobs: BlobInfo[], count: number): BlobInfo[] {
  // Group by bucket
  const byBucket: Record<string, BlobInfo[]> = {};
  for (const blob of blobs) {
    if (!byBucket[blob.bucket]) byBucket[blob.bucket] = [];
    byBucket[blob.bucket].push(blob);
  }

  // Shuffle each bucket
  for (const bucket of Object.keys(byBucket)) {
    byBucket[bucket] = shuffle(byBucket[bucket]);
  }

  const selected: BlobInfo[] = [];
  const bucketNames = ['XS', 'S', 'M', 'L', 'XL'];
  const perBucket = Math.ceil(count / bucketNames.length);

  // Pick from each bucket
  for (const bucketName of bucketNames) {
    const bucketBlobs = byBucket[bucketName] || [];
    const usedExtensions = new Set<string>();

    for (const blob of bucketBlobs) {
      if (selected.length >= count) break;

      // Prefer different extensions within bucket
      const bucketSelected = selected.filter(b => b.bucket === bucketName);
      if (bucketSelected.length >= perBucket) break;

      if (!usedExtensions.has(blob.extension) || bucketBlobs.length <= perBucket) {
        selected.push(blob);
        usedExtensions.add(blob.extension);
      }
    }
  }

  // Fill remaining slots randomly if needed
  if (selected.length < count) {
    const remaining = shuffle(blobs.filter(b => !selected.includes(b)));
    for (const blob of remaining) {
      if (selected.length >= count) break;
      selected.push(blob);
    }
  }

  return selected.slice(0, count);
}

async function downloadFile(blob: BlobInfo, outputDir: string, index: number, total: number): Promise<boolean> {
  try {
    const response = await fetch(blob.url);
    if (!response.ok) {
      console.error(`  [${index}/${total}] FAILED: ${blob.pathname} - HTTP ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    const filename = path.basename(blob.pathname);
    const outputPath = path.join(outputDir, filename);

    // Handle duplicate filenames
    let finalPath = outputPath;
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      finalPath = path.join(outputDir, `${base}_${counter}${ext}`);
      counter++;
    }

    fs.writeFileSync(finalPath, Buffer.from(buffer));
    console.log(`  [${index}/${total}] ${blob.bucket}/${path.basename(finalPath)} (${formatSize(blob.size)})`);
    return true;
  } catch (error) {
    console.error(`  [${index}/${total}] FAILED: ${blob.pathname} - ${(error as Error).message}`);
    return false;
  }
}

async function main() {
  const outputDir = './downloads';
  const targetCount = 10;

  if (!BLOB_TOKEN) {
    console.error('Error: No blob token found.\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/download-blobs.ts [token]\n');
    console.log('Or set environment variable:');
    console.log('  BLOB_READ_WRITE_TOKEN_PROD=xxx npx tsx scripts/download-blobs.ts\n');
    process.exit(1);
  }

  console.log('Fetching blobs from Vercel Blob storage...\n');

  const allBlobs = await fetchAllBlobs();
  console.log(`Found ${allBlobs.length} blobs in storage\n`);

  if (allBlobs.length === 0) {
    console.log('No blobs found. Exiting.');
    return;
  }

  // Show distribution
  const distribution: Record<string, number> = {};
  for (const blob of allBlobs) {
    distribution[blob.bucket] = (distribution[blob.bucket] || 0) + 1;
  }
  console.log('Size distribution:');
  for (const bucket of ['XS', 'S', 'M', 'L', 'XL', 'XXL']) {
    if (distribution[bucket]) {
      console.log(`  ${bucket}: ${distribution[bucket]} files`);
    }
  }
  console.log();

  // Select files
  const selected = selectVariety(allBlobs, targetCount);
  console.log(`Selected ${selected.length} files for download:\n`);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Download files
  console.log('Downloading...');
  let successCount = 0;
  let totalSize = 0;

  for (let i = 0; i < selected.length; i++) {
    const blob = selected[i];
    const success = await downloadFile(blob, outputDir, i + 1, selected.length);
    if (success) {
      successCount++;
      totalSize += blob.size;
    }
  }

  console.log(`\nCompleted: ${successCount}/${selected.length} files downloaded`);
  console.log(`Total size: ${formatSize(totalSize)}`);
  console.log(`Output: ${outputDir}/`);
}

main().catch(console.error);
