# Client-Side Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move text conversion processing from server to client to reduce server costs while keeping archival and analytics.

**Architecture:** Files are processed entirely in the browser using lazy-loaded OpenCC-js and encoding-japanese libraries. After conversion, original files are archived to Vercel Blob. Custom dictionary is cached client-side and synced when edited.

**Tech Stack:** Next.js 14, React 18, OpenCC-js, encoding-japanese, Vercel Blob

---

## Task 1: Add encoding-japanese dependency

**Files:**
- Modify: `package.json`

**Step 1: Install encoding-japanese**

Run: `npm install encoding-japanese`

**Step 2: Verify installation**

Run: `npm ls encoding-japanese`
Expected: `encoding-japanese@2.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add encoding-japanese for client-side encoding detection"
```

---

## Task 2: Create client-converter module

**Files:**
- Create: `lib/client-converter.ts`

**Step 1: Create the client converter module**

Create `lib/client-converter.ts` with the following content:

```typescript
'use client';

import { applyCustomDict, parseDictionary, type DictPair } from '@/lib/custom-dict';
import { createClient } from '@/lib/supabase/client';

// Lazy-loaded library instances
let encodingLib: typeof import('encoding-japanese') | null = null;
let converterInstance: ((text: string) => string) | null = null;

// Dictionary cache
let cachedDictPairs: DictPair[] | null = null;
let dictCacheUserId: string | null = null;

export type ConversionStage = 'loading-libs' | 'loading-dict' | 'converting' | 'archiving' | 'complete';

export interface ConversionProgress {
  stage: ConversionStage;
  percent: number;
  currentLine?: number;
  totalLines?: number;
}

export type ProgressCallback = (progress: ConversionProgress) => void;

export interface ConversionResult {
  content: string;
  fileName: string;
  encoding: string;
}

/**
 * Load converter libraries (encoding-japanese + OpenCC-js)
 * Called lazily on first conversion
 */
export async function loadConverterLibs(onProgress?: (percent: number) => void): Promise<void> {
  if (!encodingLib) {
    encodingLib = await import('encoding-japanese');
    onProgress?.(0.5);
  }

  if (!converterInstance) {
    const { ConverterFactory } = await import('opencc-js');
    const { from, to } = await import('opencc-js/preset');
    converterInstance = ConverterFactory(from.cn, to.twp);
    onProgress?.(1);
  }
}

/**
 * Check if converter libraries are loaded
 */
export function areLibsLoaded(): boolean {
  return encodingLib !== null && converterInstance !== null;
}

/**
 * Update the dictionary cache (called by CustomDictEditor when saving)
 */
export function updateDictCache(pairs: DictPair[]): void {
  cachedDictPairs = pairs;
}

/**
 * Clear the dictionary cache (called on logout)
 */
export function clearDictCache(): void {
  cachedDictPairs = null;
  dictCacheUserId = null;
}

/**
 * Load user's custom dictionary with caching
 */
export async function loadUserDictionary(userId: string | undefined): Promise<DictPair[]> {
  if (!userId) return [];

  // Return cached dictionary if same user
  if (cachedDictPairs !== null && dictCacheUserId === userId) {
    return cachedDictPairs;
  }

  try {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_dict_url, license_type')
      .eq('id', userId)
      .single();

    if (!profile?.custom_dict_url) {
      cachedDictPairs = [];
      dictCacheUserId = userId;
      return [];
    }

    const response = await fetch(profile.custom_dict_url);
    if (!response.ok) {
      cachedDictPairs = [];
      dictCacheUserId = userId;
      return [];
    }

    const csvText = await response.text();
    const pairs = parseDictionary(csvText);

    // Apply license limit
    const limit = profile.license_type === 'free' ? 5 : 10000;
    cachedDictPairs = pairs.slice(0, limit);
    dictCacheUserId = userId;

    return cachedDictPairs;
  } catch (error) {
    console.error('Error loading custom dictionary:', error);
    return [];
  }
}

/**
 * Detect encoding and decode file content
 */
export async function readFileWithEncoding(file: File): Promise<{ content: string; encoding: string }> {
  if (!encodingLib) {
    throw new Error('Encoding library not loaded. Call loadConverterLibs first.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Handle empty files
  if (uint8Array.length === 0) {
    return { content: '', encoding: 'UTF-8' };
  }

  // Detect encoding using encoding-japanese
  const detected = encodingLib.detect(uint8Array);
  const encoding = detected || 'UTF8';

  // Convert to Unicode array
  const unicodeArray = encodingLib.convert(uint8Array, {
    to: 'UNICODE',
    from: encoding,
  });

  // Convert Unicode array to string
  const content = encodingLib.codeToString(unicodeArray);

  // Map encoding names to display names
  const encodingDisplayMap: Record<string, string> = {
    'UTF8': 'UTF-8',
    'SJIS': 'Shift_JIS',
    'EUCJP': 'EUC-JP',
    'JIS': 'ISO-2022-JP',
    'UNICODE': 'UTF-16',
    'GB2312': 'GB2312',
    'GB18030': 'GB18030',
    'GBK': 'GBK',
    'BIG5': 'Big5',
  };

  return {
    content,
    encoding: encodingDisplayMap[encoding] || encoding,
  };
}

/**
 * Convert text using OpenCC
 */
export function convertText(text: string): string {
  if (!converterInstance) {
    throw new Error('Converter not loaded. Call loadConverterLibs first.');
  }
  return converterInstance(text);
}

/**
 * Convert file content line by line with progress callback
 */
export async function convertWithProgress(
  fileContent: string,
  customPairs: DictPair[],
  onProgress: (percent: number, currentLine: number, totalLines: number) => void
): Promise<string> {
  if (!converterInstance) {
    throw new Error('Converter not loaded. Call loadConverterLibs first.');
  }

  // Handle empty file
  if (!fileContent) {
    onProgress(1, 0, 0);
    return '';
  }

  const lines = fileContent.split('\n');
  const totalLines = lines.length;
  const convertedLines: string[] = [];

  // Report progress every 1% (or at least every 100 lines)
  const progressInterval = Math.max(1, Math.ceil(totalLines / 100));

  for (let i = 0; i < totalLines; i++) {
    if (customPairs.length > 0) {
      convertedLines.push(applyCustomDict(lines[i], customPairs, converterInstance));
    } else {
      convertedLines.push(converterInstance(lines[i]));
    }

    // Report progress
    if (i % progressInterval === 0 || i === totalLines - 1) {
      const percent = (i + 1) / totalLines;
      onProgress(percent, i + 1, totalLines);

      // Yield to UI thread every progress update
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return convertedLines.join('\n');
}

/**
 * Generate converted filename
 */
export function generateConvertedFilename(originalName: string): string {
  if (!converterInstance) {
    throw new Error('Converter not loaded. Call loadConverterLibs first.');
  }

  const lastDot = originalName.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const extension = lastDot > 0 ? originalName.slice(lastDot) : '';

  // Convert filename from simplified to traditional Chinese
  const convertedName = converterInstance(nameWithoutExt);

  // Basic sanitization (remove invalid filename characters)
  const sanitized = convertedName
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\.+$/g, '')
    .trim();

  return (sanitized || 'converted') + extension;
}

/**
 * Full conversion pipeline for a single file
 */
export async function convertFile(
  file: File,
  userId: string | undefined,
  onProgress: ProgressCallback
): Promise<ConversionResult> {
  // Stage 1: Load libraries (0-10%)
  onProgress({ stage: 'loading-libs', percent: 0 });
  await loadConverterLibs((p) => {
    onProgress({ stage: 'loading-libs', percent: p * 0.1 });
  });

  // Stage 2: Load dictionary (10-15%)
  onProgress({ stage: 'loading-dict', percent: 0.1 });
  const customPairs = await loadUserDictionary(userId);
  onProgress({ stage: 'loading-dict', percent: 0.15 });

  // Stage 3: Read file and detect encoding
  onProgress({ stage: 'converting', percent: 0.15 });
  const { content: fileContent, encoding } = await readFileWithEncoding(file);

  // Stage 4: Convert with progress (15-95%)
  const convertedContent = await convertWithProgress(
    fileContent,
    customPairs,
    (percent, currentLine, totalLines) => {
      onProgress({
        stage: 'converting',
        percent: 0.15 + percent * 0.8,
        currentLine,
        totalLines,
      });
    }
  );

  // Generate converted filename
  const fileName = generateConvertedFilename(file.name);

  onProgress({ stage: 'converting', percent: 0.95 });

  return {
    content: convertedContent,
    fileName,
    encoding,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit lib/client-converter.ts 2>&1 | head -20`
Expected: No errors (or only minor warnings)

**Step 3: Commit**

```bash
git add lib/client-converter.ts
git commit -m "feat: add client-side converter module with lazy loading and dict caching"
```

---

## Task 3: Update CustomDictEditor to sync with dictionary cache

**Files:**
- Modify: `components/CustomDictEditor.tsx`

**Step 1: Import updateDictCache from client-converter**

Add import at top of file after existing imports:

```typescript
import { updateDictCache } from '@/lib/client-converter';
```

**Step 2: Call updateDictCache when dictionary is saved**

In the `performSave` function, after `setSavedContent(contentToSave);` add:

```typescript
      // Update client-side cache for conversion
      updateDictCache(parseDictionary(contentToSave));
```

**Step 3: Call updateDictCache when content is loaded**

In the `useEffect` that loads dictionary, after `setSavedContent(loaded);` add:

```typescript
        // Update client-side cache
        updateDictCache(parseDictionary(loaded));
```

**Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add components/CustomDictEditor.tsx
git commit -m "feat: sync CustomDictEditor with client-side dictionary cache"
```

---

## Task 4: Update FileUpload to use client-side conversion

**Files:**
- Modify: `components/FileUpload.tsx`

**Step 1: Update imports**

Replace the existing imports at the top with:

```typescript
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { upload } from '@vercel/blob/client';
import { validateFile } from '@/lib/file-validator';
import {
  convertFile as clientConvertFile,
  type ConversionProgress,
} from '@/lib/client-converter';
import {
  trackFileUploadStarted,
  trackFileUploadCompleted,
  trackFileUploadFailed,
  trackFileConversionStarted,
  trackFileConversionCompleted,
  trackFileConversionFailed,
} from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
```

**Step 2: Add user state to component**

After the existing state declarations, add:

```typescript
  const [userId, setUserId] = useState<string | undefined>(undefined);

  // Get user ID on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });
  }, []);
```

**Step 3: Replace the convertFile function**

Replace the entire `convertFile` useCallback with:

```typescript
  const convertFile = useCallback(async (uploadFile: UploadFile) => {
    const { id, file } = uploadFile;

    // Track conversion started
    trackFileConversionStarted(file);
    const conversionStartTime = Date.now();

    // Set initial state
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              isUploading: false,
              isProcessing: true,
              uploadProgress: 0,
              convertProgress: 0,
              errMessage: null,
              conversionStartTime,
              isRetryable: false,
            }
          : f
      )
    );

    let convertedContent: string;
    let convertedFileName: string;
    let inputEncoding: string;

    try {
      // Run client-side conversion with progress
      const result = await clientConvertFile(file, userId, (progress: ConversionProgress) => {
        let displayPercent = progress.percent;

        // Map stages to progress ranges for UI
        // loading-libs: 0-10%, loading-dict: 10-15%, converting: 15-95%, archiving: 95-100%
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  convertProgress: displayPercent,
                }
              : f
          )
        );
      });

      convertedContent = result.content;
      convertedFileName = result.fileName;
      inputEncoding = result.encoding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Conversion failed';
      trackFileConversionFailed(file, 'processing_error', errorMessage);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                isUploading: false,
                isProcessing: false,
                errMessage: errorMessage,
                isRetryable: true,
              }
            : f
        )
      );
      return;
    }

    // Archive original file to Vercel Blob
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, convertProgress: 0.95 } : f
      )
    );

    try {
      // Track upload for archival
      trackFileUploadStarted(file, lastUploadMethod.current);
      const uploadStartTime = Date.now();

      await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      const uploadDuration = Date.now() - uploadStartTime;
      trackFileUploadCompleted(file, uploadDuration);
    } catch (error) {
      // Archive failure is non-fatal, just log it
      console.error('Failed to archive file:', error);
    }

    // Track successful conversion
    const conversionDuration = Date.now() - conversionStartTime;
    trackFileConversionCompleted(file, conversionDuration, inputEncoding);

    // Update state with converted file
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              isProcessing: false,
              convertProgress: 1.0,
              downloadLink: 'blob://converted',
              filename: convertedFileName,
              convertedContent: convertedContent,
              inputEncoding,
            }
          : f
      )
    );

    // Add to download queue
    setDownloadQueue((prev) => [...prev, { content: convertedContent, fileName: convertedFileName }]);
  }, [userId]);
```

**Step 4: Simplify onDrop to remove upload step**

In the `onDrop` callback, the files no longer need to be uploaded first. Update the auto-convert section:

```typescript
    // Auto-convert only valid files (client-side, no upload needed)
    newFiles.forEach((uploadFile, index) => {
      if (!uploadFile.errMessage) {
        setTimeout(() => {
          convertFile(uploadFile);
        }, index * 100); // Stagger by 100ms
      }
    });
```

**Step 5: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add components/FileUpload.tsx
git commit -m "feat: replace server-side SSE conversion with client-side processing"
```

---

## Task 5: Delete server-side convert API route

**Files:**
- Delete: `app/api/convert/route.ts`

**Step 1: Delete the file**

Run: `rm app/api/convert/route.ts`

**Step 2: Verify no imports reference it**

Run: `grep -r "api/convert" --include="*.ts" --include="*.tsx" .`
Expected: No results (FileUpload.tsx was already updated)

**Step 3: Verify build still works**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove server-side convert API (replaced by client-side)"
```

---

## Task 6: Manual testing with Chrome DevTools

**Step 1: Start development server**

Run: `npm run dev`

**Step 2: Open browser and test conversion flow**

1. Navigate to http://localhost:3000
2. Upload a small .txt file with simplified Chinese text
3. Verify progress stages show correctly
4. Verify file downloads with converted content
5. Check browser console for any errors

**Step 3: Test with custom dictionary (if logged in)**

1. Login to the app
2. Add a custom dictionary entry
3. Upload a file containing the simplified term
4. Verify the custom dictionary mapping is applied

**Step 4: Test encoding detection**

1. Upload a GBK-encoded file
2. Verify it converts correctly without garbled characters

---

## Task 7: Final verification and commit

**Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Create summary commit if needed**

If there are any remaining changes:

```bash
git status
git add -A
git commit -m "feat: complete client-side conversion migration"
```

---

## Verification Checklist

After implementation, verify these scenarios work:

- [ ] Upload single file → converts and downloads
- [ ] Upload multiple files → all convert in sequence
- [ ] Progress shows loading stages (libs, dict, converting)
- [ ] Retry works after simulated failure
- [ ] Custom dictionary applies when logged in
- [ ] GBK/GB2312 encoded files convert correctly
- [ ] Original files are archived to Vercel Blob
- [ ] Analytics events fire correctly
