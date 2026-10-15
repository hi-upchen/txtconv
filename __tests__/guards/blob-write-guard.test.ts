/**
 * @jest-environment node
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// Files allowed to write to Vercel Blob. Only the custom dictionary API may.
// Every other write path has been removed on purpose. Uploaded files used to
// be archived to Blob, and that filled the store with 174 GB of user data.
// This test fails the build if a new write path appears anywhere else.
const ALLOWED_WRITERS = ['app/api/dictionary/route.ts'];

// Folders that never hold application code. They are skipped.
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.claude',
  '.worktrees',
  'coverage',
  'playwright-report',
  'test-results',
  'out',
  'build',
  'public',
  'docs',
  'e2e',
  '__tests__',
  '__mocks__',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// These @vercel/blob exports create or change blobs.
const WRITE_APIS = new Set([
  'put',
  'copy',
  'upload',
  'handleUpload',
  'createFolder',
  'createMultipartUpload',
  'createMultipartUploader',
  'uploadPart',
  'completeMultipartUpload',
]);

const REPO_ROOT = path.resolve(__dirname, '..', '..');

interface BlobWrite {
  file: string;
  api: string;
}

// Returns every Blob write API a source file pulls in.
//
// It looks at import statements and require calls, not at call sites.
// A namespace import, a require, or a dynamic import of '@vercel/blob'
// counts as a write, because any export could be used through it.
// Any use of '@vercel/blob/client' counts as a write. That module only
// exists to upload from the browser.
export function findBlobWrites(source: string, file: string): BlobWrite[] {
  const found: BlobWrite[] = [];

  if (/['"]@vercel\/blob\/client['"]/.test(source)) {
    found.push({ file, api: '@vercel/blob/client' });
  }

  const namedImports = source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@vercel\/blob['"]/g);
  for (const match of namedImports) {
    const names = match[1]
      .split(',')
      .map((part) => part.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    for (const name of names) {
      if (WRITE_APIS.has(name)) found.push({ file, api: name });
    }
  }

  if (/import\s+\*\s+as\s+\w+\s+from\s*['"]@vercel\/blob['"]/.test(source)) {
    found.push({ file, api: 'namespace import' });
  }
  if (/require\(\s*['"]@vercel\/blob['"]\s*\)/.test(source)) {
    found.push({ file, api: 'require' });
  }
  if (/import\(\s*['"]@vercel\/blob['"]\s*\)/.test(source)) {
    found.push({ file, api: 'dynamic import' });
  }

  return found;
}

// Lists every source file under the repo root, skipping the folders above.
function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) files.push(...listSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

describe('Vercel Blob write guard', () => {
  it('recognises imports that can write to Blob', () => {
    expect(findBlobWrites("import { put } from '@vercel/blob';", 'a.ts')).toEqual([{ file: 'a.ts', api: 'put' }]);
    expect(findBlobWrites("import { list, copy as cp } from '@vercel/blob';", 'a.ts')).toEqual([{ file: 'a.ts', api: 'copy' }]);
    expect(findBlobWrites("import { upload } from '@vercel/blob/client';", 'a.ts')).toEqual([
      { file: 'a.ts', api: '@vercel/blob/client' },
    ]);
    expect(findBlobWrites("import * as blob from '@vercel/blob';", 'a.ts')).toEqual([{ file: 'a.ts', api: 'namespace import' }]);
    expect(findBlobWrites("const { put } = require('@vercel/blob');", 'a.ts')).toEqual([{ file: 'a.ts', api: 'require' }]);
    expect(findBlobWrites("const blob = await import('@vercel/blob');", 'a.ts')).toEqual([{ file: 'a.ts', api: 'dynamic import' }]);
  });

  it('ignores imports that only read or delete', () => {
    expect(findBlobWrites("import { list, head, del } from '@vercel/blob';", 'a.ts')).toEqual([]);
    expect(findBlobWrites("import { NextResponse } from 'next/server';", 'a.ts')).toEqual([]);
  });

  it('only the dictionary API writes to Blob', () => {
    const writers: BlobWrite[] = [];
    for (const file of listSourceFiles(REPO_ROOT)) {
      const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
      writers.push(...findBlobWrites(fs.readFileSync(file, 'utf8'), relative));
    }

    // The known writer must show up. If it does not, the scan is broken
    // and a green result would mean nothing.
    const allowed = writers.filter((w) => ALLOWED_WRITERS.includes(w.file));
    expect(allowed.map((w) => w.api)).toEqual(['put']);

    // Each entry names the file and the API, so a failure says what to fix.
    const forbidden = writers
      .filter((w) => !ALLOWED_WRITERS.includes(w.file))
      .map((w) => `${w.file} uses ${w.api} (only app/api/dictionary/route.ts may write to Blob)`);
    expect(forbidden).toEqual([]);
  });
});
