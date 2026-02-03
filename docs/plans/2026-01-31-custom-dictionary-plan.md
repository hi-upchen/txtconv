# Custom Dictionary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to provide custom simplified-to-traditional Chinese translation pairs that override the built-in opencc dictionary, with limits based on license tier (5 free, 10,000 paid).

**Architecture:** Custom dictionary pairs are stored as CSV text in Vercel Blob (one file per user). During conversion, user pairs are applied via a placeholder-based pipeline: replace matched simplified keys with null-byte placeholders, run opencc, then replace placeholders with user's traditional values. The UI is a collapsible textarea-style editor on the homepage between file upload and pricing.

**Tech Stack:** Next.js 14 (App Router), Supabase (auth + profiles table), Vercel Blob (dictionary storage), opencc-js (base conversion), Jest (testing), Tailwind CSS (styling)

---

### Task 1: Custom Dictionary Parsing & Validation Library

**Files:**
- Create: `lib/custom-dict.ts`
- Create: `__tests__/lib/custom-dict.test.ts`

**Context:**
- Dictionary format: one pair per line, comma-separated: `simplified,traditional`
- Blank lines are silently skipped
- Validation errors return line number and Chinese error message
- This library is pure logic — no Supabase, no Blob, no Next.js dependencies

**Step 1: Write the failing tests**

Create `__tests__/lib/custom-dict.test.ts`:

```typescript
import {
  parseDictionary,
  validateDictionary,
  getDictPairLimit,
  type DictPair,
  type DictValidationError,
} from '@/lib/custom-dict';

describe('custom-dict', () => {
  describe('parseDictionary', () => {
    it('should parse valid CSV lines into pairs', () => {
      const result = parseDictionary('代码,程式\n内存,記憶體');
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should skip blank lines', () => {
      const result = parseDictionary('代码,程式\n\n内存,記憶體\n');
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式' },
        { simplified: '内存', traditional: '記憶體' },
      ]);
    });

    it('should return empty array for empty string', () => {
      const result = parseDictionary('');
      expect(result).toEqual([]);
    });

    it('should trim whitespace from keys and values', () => {
      const result = parseDictionary(' 代码 , 程式 ');
      expect(result).toEqual([
        { simplified: '代码', traditional: '程式' },
      ]);
    });
  });

  describe('validateDictionary', () => {
    it('should return no errors for valid content', () => {
      const errors = validateDictionary('代码,程式\n内存,記憶體');
      expect(errors).toEqual([]);
    });

    it('should detect missing comma', () => {
      const errors = validateDictionary('代码程式');
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：缺少逗號' },
      ]);
    });

    it('should detect multiple commas', () => {
      const errors = validateDictionary('代码,程式,extra');
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：只能有一個逗號' },
      ]);
    });

    it('should detect empty left side', () => {
      const errors = validateDictionary(',程式');
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：簡體和繁體都不能為空' },
      ]);
    });

    it('should detect empty right side', () => {
      const errors = validateDictionary('代码,');
      expect(errors).toEqual([
        { line: 1, message: '第 1 行格式錯誤：簡體和繁體都不能為空' },
      ]);
    });

    it('should detect duplicate simplified keys', () => {
      const errors = validateDictionary('代码,程式\n代码,程式碼');
      expect(errors).toEqual([
        { line: 2, message: "第 2 行重複：'代码' 已在第 1 行定義" },
      ]);
    });

    it('should skip blank lines without error', () => {
      const errors = validateDictionary('代码,程式\n\n内存,記憶體');
      expect(errors).toEqual([]);
    });

    it('should report multiple errors', () => {
      const errors = validateDictionary('代码程式\n,程式\n好的,OK');
      expect(errors).toHaveLength(2);
      expect(errors[0].line).toBe(1);
      expect(errors[1].line).toBe(2);
    });
  });

  describe('getDictPairLimit', () => {
    it('should return 5 for free users', () => {
      expect(getDictPairLimit('free')).toBe(5);
    });

    it('should return 10000 for monthly users', () => {
      expect(getDictPairLimit('monthly')).toBe(10000);
    });

    it('should return 10000 for lifetime users', () => {
      expect(getDictPairLimit('lifetime')).toBe(10000);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/custom-dict.test.ts --no-coverage`
Expected: FAIL — module `@/lib/custom-dict` not found

**Step 3: Write the implementation**

Create `lib/custom-dict.ts`:

```typescript
import type { LicenseType } from '@/types/user';

export interface DictPair {
  simplified: string;
  traditional: string;
}

export interface DictValidationError {
  line: number;
  message: string;
}

const PAIR_LIMITS: Record<LicenseType, number> = {
  free: 5,
  monthly: 10000,
  lifetime: 10000,
};

/**
 * Get the maximum number of dictionary pairs allowed for a license type
 */
export function getDictPairLimit(licenseType: LicenseType): number {
  return PAIR_LIMITS[licenseType];
}

/**
 * Parse dictionary CSV text into pairs.
 * Skips blank lines. Does NOT validate — use validateDictionary() for that.
 * Only returns pairs from lines that have exactly one comma and non-empty sides.
 */
export function parseDictionary(content: string): DictPair[] {
  if (!content.trim()) return [];

  const pairs: DictPair[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const commaCount = (trimmed.match(/,/g) || []).length;
    if (commaCount !== 1) continue;

    const [left, right] = trimmed.split(',');
    const simplified = left.trim();
    const traditional = right.trim();

    if (simplified && traditional) {
      pairs.push({ simplified, traditional });
    }
  }

  return pairs;
}

/**
 * Validate dictionary CSV text and return all errors.
 * Blank lines are silently skipped.
 */
export function validateDictionary(content: string): DictValidationError[] {
  if (!content.trim()) return [];

  const errors: DictValidationError[] = [];
  const lines = content.split('\n');
  const seenKeys = new Map<string, number>(); // simplified -> line number

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    const lineNum = i + 1;
    const commaCount = (trimmed.match(/,/g) || []).length;

    if (commaCount === 0) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行格式錯誤：缺少逗號` });
      continue;
    }

    if (commaCount > 1) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行格式錯誤：只能有一個逗號` });
      continue;
    }

    const [left, right] = trimmed.split(',');
    const simplified = left.trim();
    const traditional = right.trim();

    if (!simplified || !traditional) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行格式錯誤：簡體和繁體都不能為空` });
      continue;
    }

    const existingLine = seenKeys.get(simplified);
    if (existingLine !== undefined) {
      errors.push({ line: lineNum, message: `第 ${lineNum} 行重複：'${simplified}' 已在第 ${existingLine} 行定義` });
      continue;
    }

    seenKeys.set(simplified, lineNum);
  }

  return errors;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/custom-dict.test.ts --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/custom-dict.ts __tests__/lib/custom-dict.test.ts
git commit -m "feat: add custom dictionary parsing and validation library"
```

---

### Task 2: Placeholder-Based Conversion Logic

**Files:**
- Modify: `lib/custom-dict.ts` (add `applyCustomDict` function)
- Modify: `__tests__/lib/custom-dict.test.ts` (add tests)

**Context:**
- The conversion pipeline is: (1) replace user dict simplified keys with placeholders, (2) run opencc, (3) replace placeholders with traditional values
- Placeholders use null bytes: `\x00DICT_0\x00`, `\x00DICT_1\x00`, etc. — these are ASCII and won't be touched by opencc
- Keys must be sorted by length descending (longest match first) to prevent partial replacements
- The opencc converter is a function `(text: string) => string` — we accept it as a parameter
- The mock converter in tests does simple character replacements (see `lib/__mocks__/opencc-js.ts`)

**Step 1: Write the failing tests**

Add to `__tests__/lib/custom-dict.test.ts`:

```typescript
import {
  parseDictionary,
  validateDictionary,
  getDictPairLimit,
  applyCustomDict,
  type DictPair,
  type DictValidationError,
} from '@/lib/custom-dict';

// ... existing tests ...

describe('applyCustomDict', () => {
  // Simple mock converter for testing
  const mockConverter = (text: string) => {
    return text
      .replace(/简/g, '簡')
      .replace(/体/g, '體')
      .replace(/代码/g, '代碼')
      .replace(/内存/g, '內存');
  };

  it('should apply custom pairs via placeholder approach', () => {
    const pairs: DictPair[] = [
      { simplified: '代码', traditional: '程式' },
    ];
    // Without custom dict, opencc would convert 代码 → 代碼
    // With custom dict, user wants 代码 → 程式
    const result = applyCustomDict('这是代码', pairs, mockConverter);
    expect(result).toBe('這是程式');  // Note: mock doesn't convert 这→這, that's ok
  });

  it('should let opencc handle non-custom text normally', () => {
    const pairs: DictPair[] = [
      { simplified: '代码', traditional: '程式' },
    ];
    const result = applyCustomDict('简体', pairs, mockConverter);
    expect(result).toBe('簡體');
  });

  it('should handle multiple custom pairs', () => {
    const pairs: DictPair[] = [
      { simplified: '代码', traditional: '程式' },
      { simplified: '内存', traditional: '記憶體' },
    ];
    const result = applyCustomDict('代码和内存', pairs, mockConverter);
    expect(result).toContain('程式');
    expect(result).toContain('記憶體');
  });

  it('should use longest match first', () => {
    const pairs: DictPair[] = [
      { simplified: '信息', traditional: '訊息' },
      { simplified: '信息技术', traditional: '資訊科技' },
    ];
    const result = applyCustomDict('信息技术很重要', pairs, mockConverter);
    expect(result).toContain('資訊科技');
  });

  it('should handle empty pairs array', () => {
    const result = applyCustomDict('简体', [], mockConverter);
    expect(result).toBe('簡體');
  });

  it('should handle text with no matching custom keys', () => {
    const pairs: DictPair[] = [
      { simplified: '代码', traditional: '程式' },
    ];
    const result = applyCustomDict('简体', pairs, mockConverter);
    expect(result).toBe('簡體');
  });

  it('should handle multiple occurrences of same key', () => {
    const pairs: DictPair[] = [
      { simplified: '代码', traditional: '程式' },
    ];
    const result = applyCustomDict('代码和代码', pairs, mockConverter);
    expect(result).toBe('程式和程式');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/custom-dict.test.ts --no-coverage`
Expected: FAIL — `applyCustomDict` is not exported

**Step 3: Write the implementation**

Add to `lib/custom-dict.ts`:

```typescript
/**
 * Apply custom dictionary pairs to text using placeholder-based approach.
 *
 * Pipeline:
 * 1. Replace user dict simplified keys with null-byte placeholders (longest first)
 * 2. Run opencc converter on the text
 * 3. Replace placeholders with user's specified traditional values
 *
 * @param text - Input text (simplified Chinese)
 * @param pairs - Custom dictionary pairs
 * @param converter - OpenCC converter function (text: string) => string
 * @returns Converted text with custom pairs applied
 */
export function applyCustomDict(
  text: string,
  pairs: DictPair[],
  converter: (text: string) => string
): string {
  if (pairs.length === 0) {
    return converter(text);
  }

  // Sort by simplified key length descending (longest match first)
  const sortedPairs = [...pairs].sort(
    (a, b) => b.simplified.length - a.simplified.length
  );

  // Step 1: Replace simplified keys with null-byte-wrapped placeholders
  let processed = text;
  const placeholderMap: Map<string, string> = new Map();

  for (let i = 0; i < sortedPairs.length; i++) {
    const placeholder = `\x00DICT_${i}\x00`;
    placeholderMap.set(placeholder, sortedPairs[i].traditional);

    // Replace all occurrences of this simplified key
    const escaped = sortedPairs[i].simplified.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    processed = processed.replace(new RegExp(escaped, 'g'), placeholder);
  }

  // Step 2: Run opencc converter (placeholders are untouched)
  processed = converter(processed);

  // Step 3: Replace placeholders with traditional values
  for (const [placeholder, traditional] of placeholderMap) {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    processed = processed.replace(new RegExp(escaped, 'g'), traditional);
  }

  return processed;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/custom-dict.test.ts --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/custom-dict.ts __tests__/lib/custom-dict.test.ts
git commit -m "feat: add placeholder-based custom dictionary conversion"
```

---

### Task 3: Update Profile Type & Database Schema

**Files:**
- Modify: `types/user.ts:1-13` (add `custom_dict_url` field)

**Context:**
- The `Profile` interface is used throughout the app
- Add nullable `custom_dict_url` field to the interface
- The actual DB migration (`ALTER TABLE profiles ADD COLUMN custom_dict_url TEXT NULL`) must be run manually in the Supabase dashboard

**Step 1: Update the Profile type**

In `types/user.ts`, add `custom_dict_url` after `updated_at`:

```typescript
export interface Profile {
  id: string;
  email: string;
  license_type: LicenseType;
  license_expires_at: string | null;
  gumroad_purchase_id: string | null;
  gumroad_product_id: string | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
  custom_dict_url: string | null;
}
```

**Step 2: Run existing tests to verify nothing breaks**

Run: `npx jest --no-coverage`
Expected: All existing tests PASS (the new field is nullable, so existing mocks still work)

**Step 3: Commit**

```bash
git add types/user.ts
git commit -m "feat: add custom_dict_url field to Profile type"
```

**Step 4: Run SQL migration in Supabase**

**MANUAL STEP**: Run this SQL in the Supabase dashboard SQL editor:

```sql
ALTER TABLE profiles ADD COLUMN custom_dict_url TEXT NULL;
```

---

### Task 4: Dictionary API Endpoints

**Files:**
- Create: `app/api/dictionary/route.ts`
- Create: `__tests__/api/dictionary.test.ts`

**Context:**
- `GET /api/dictionary` — returns user's dictionary content from Vercel Blob
- `POST /api/dictionary` — validates, uploads to Vercel Blob, updates profile
- Both require authentication (via Supabase session cookie)
- Uses `createClient()` from `lib/supabase/server.ts` for auth
- Uses `createServiceClient()` for profile updates (bypass RLS)
- Uses `put()` from `@vercel/blob` for blob storage (see `lib/archive.ts` for pattern)
- Pair limit is enforced server-side based on `profile.license_type`

**Step 1: Write the failing tests**

Create `__tests__/api/dictionary.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/dictionary/route';

// Mock Supabase
const mockGetUser = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    auth: { getUser: mockGetUser },
  })),
  createServiceClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: mockSingle,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ error: null })),
      })),
    })),
  })),
}));

// Mock Vercel Blob
const mockPut = jest.fn();
jest.mock('@vercel/blob', () => ({
  put: (...args: any[]) => mockPut(...args),
}));

// Mock fetch for blob content retrieval
const originalFetch = global.fetch;

describe('Dictionary API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('GET /api/dictionary', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const request = new Request('http://localhost:3000/api/dictionary');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBeDefined();
    });
  });

  describe('POST /api/dictionary', () => {
    it('should return 401 if not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const request = new Request('http://localhost:3000/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '代码,程式' }),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBeDefined();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/dictionary.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `app/api/dictionary/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { validateDictionary, parseDictionary, getDictPairLimit } from '@/lib/custom-dict';
import { isPaidUser } from '@/lib/auth';

/**
 * GET /api/dictionary
 * Fetch the authenticated user's custom dictionary content
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('custom_dict_url, license_type')
    .eq('id', user.id)
    .single();

  if (!profile?.custom_dict_url) {
    return NextResponse.json({ content: '', pairCount: 0 });
  }

  try {
    const response = await fetch(profile.custom_dict_url);
    if (!response.ok) {
      throw new Error('Failed to fetch dictionary from blob');
    }
    const content = await response.text();
    const pairs = parseDictionary(content);
    return NextResponse.json({ content, pairCount: pairs.length });
  } catch (error) {
    console.error('Error fetching dictionary:', error);
    return NextResponse.json({ content: '', pairCount: 0 });
  }
}

/**
 * POST /api/dictionary
 * Save the authenticated user's custom dictionary content
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  const body = await request.json();
  const content: string = body.content ?? '';

  // Get profile for license check
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('license_type')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: '找不到使用者資料' }, { status: 404 });
  }

  // Validate format
  const errors = validateDictionary(content);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 });
  }

  // Check pair limit
  const pairs = parseDictionary(content);
  const limit = getDictPairLimit(profile.license_type);
  if (pairs.length > limit) {
    return NextResponse.json({
      error: `超過上限：${profile.license_type === 'free' ? '免費版' : '付費版'}最多 ${limit} 組對照`,
    }, { status: 400 });
  }

  // Upload to Vercel Blob (overwrite by using same pathname)
  const blob = await put(`dictionaries/${user.id}.csv`, content, {
    access: 'public',
    addRandomSuffix: false, // Same path per user, overwrite on each save
    contentType: 'text/csv; charset=utf-8',
  });

  // Update profile with blob URL
  const { error: updateError } = await serviceClient
    .from('profiles')
    .update({
      custom_dict_url: blob.url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateError) {
    console.error('Error updating profile with dict URL:', updateError);
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
  }

  return NextResponse.json({ success: true, pairCount: pairs.length });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api/dictionary.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/dictionary/route.ts __tests__/api/dictionary.test.ts
git commit -m "feat: add dictionary API endpoints (GET/POST)"
```

---

### Task 5: Integrate Custom Dictionary Into Conversion Pipeline

**Files:**
- Modify: `lib/opencc.ts` (add `convertFileWithCustomDict`)
- Modify: `app/api/convert/route.ts` (fetch user dict, pass to conversion)
- Modify: `__tests__/lib/opencc.test.ts` (add tests)

**Context:**
- `convertFile()` currently converts line-by-line with opencc
- New `convertFileWithCustomDict()` wraps each line through `applyCustomDict()` before/after opencc
- `/api/convert` needs to check if authenticated user has a `custom_dict_url`, fetch it, parse it, and pass pairs to the converter
- The convert endpoint currently has NO auth — it's anonymous. We need to optionally read the session to get user's dict.
- If no auth or no dict, fall back to current behavior (no custom dict)

**Step 1: Write the failing tests for `convertFileWithCustomDict`**

Add to `__tests__/lib/opencc.test.ts`:

```typescript
import { getConverter, convertText, convertFile, convertFileWithCustomDict } from '@/lib/opencc';

// ... existing tests ...

describe('convertFileWithCustomDict', () => {
  it('should apply custom dict pairs during conversion', async () => {
    const fileContent = '代码和简体';
    const customPairs = [{ simplified: '代码', traditional: '程式' }];
    const result = await convertFileWithCustomDict(fileContent, customPairs);
    // '代码' should become '程式' (custom), '简体' should become '簡體' (opencc mock)
    expect(result).toContain('程式');
    expect(result).toContain('簡體');
  });

  it('should behave like convertFile when custom pairs is empty', async () => {
    const fileContent = '简体中文';
    const result = await convertFileWithCustomDict(fileContent, []);
    const normalResult = await convertFile(fileContent);
    expect(result).toBe(normalResult);
  });

  it('should call progress callback', async () => {
    const fileContent = '代码\n简体\n内容';
    const customPairs = [{ simplified: '代码', traditional: '程式' }];
    const progressUpdates: number[] = [];

    await convertFileWithCustomDict(fileContent, customPairs, (p) => {
      progressUpdates.push(p);
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(1.0);
  });

  it('should handle multi-line content with custom dict', async () => {
    const fileContent = '第一行代码\n第二行内容';
    const customPairs = [{ simplified: '代码', traditional: '程式' }];
    const result = await convertFileWithCustomDict(fileContent, customPairs);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('程式');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/opencc.test.ts --no-coverage`
Expected: FAIL — `convertFileWithCustomDict` not exported

**Step 3: Implement `convertFileWithCustomDict` in `lib/opencc.ts`**

Add to `lib/opencc.ts` (after the existing `convertFile` function):

```typescript
import { applyCustomDict, type DictPair } from '@/lib/custom-dict';

/**
 * Convert file content with custom dictionary pairs.
 * Uses placeholder-based approach: custom keys → placeholders → opencc → replace placeholders.
 *
 * @param fileContent - File content as string
 * @param customPairs - Custom dictionary pairs (simplified → traditional)
 * @param onProgress - Optional progress callback (0.0 to 1.0)
 * @returns Promise<string> Converted file content
 */
export async function convertFileWithCustomDict(
  fileContent: string,
  customPairs: DictPair[],
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!fileContent) {
    if (onProgress) onProgress(1.0);
    return '';
  }

  if (customPairs.length === 0) {
    return convertFile(fileContent, onProgress);
  }

  const converter = await getConverter();
  const lines = fileContent.split('\n');
  const totalLines = lines.length;
  const convertedLines: string[] = [];

  const progressInterval = Math.max(1, Math.ceil(totalLines / 100));
  const DELAY_MS = parseInt(process.env.CONVERSION_PROGRESS_DELAY_MS || '0', 10);

  for (let i = 0; i < totalLines; i++) {
    convertedLines.push(applyCustomDict(lines[i], customPairs, converter));

    if (onProgress && (i % progressInterval === 0 || i === totalLines - 1)) {
      const percent = (i + 1) / totalLines;
      onProgress(percent);

      if (DELAY_MS > 0) {
        await sleep(DELAY_MS);
      }
    }
  }

  return convertedLines.join('\n');
}
```

**Step 4: Modify `/api/convert` to fetch and use custom dictionary**

In `app/api/convert/route.ts`, add at the top:

```typescript
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { parseDictionary, getDictPairLimit, type DictPair } from '@/lib/custom-dict';
import { convertFileWithCustomDict } from '@/lib/opencc';  // new import
import { isPaidUser } from '@/lib/auth';
```

Replace the existing `convertFile` call (around line 102) with logic that:
1. Optionally reads the user's session (non-blocking — no auth required)
2. If user has `custom_dict_url`, fetch and parse the dictionary
3. Call `convertFileWithCustomDict()` instead of `convertFile()`

The key change in the stream's `start()` function, right before the conversion call (after reading the file content, around line 100):

```typescript
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
        // Enforce pair limit
        const limit = getDictPairLimit(profile.license_type);
        customPairs = allPairs.slice(0, limit);
      }
    }
  }
} catch (error) {
  // Graceful degradation — proceed without custom dict
  console.error('Error fetching custom dictionary:', error);
}

// Convert file with progress updates (use custom dict if available)
const convertedContent = await convertFileWithCustomDict(fileContent, customPairs, (percent) => {
  // ... existing progress callback ...
});
```

**Step 5: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add lib/opencc.ts app/api/convert/route.ts __tests__/lib/opencc.test.ts
git commit -m "feat: integrate custom dictionary into conversion pipeline"
```

---

### Task 6: Custom Dictionary Editor UI Component

**Files:**
- Create: `components/CustomDictEditor.tsx`
- Modify: `app/page.tsx` (add component between FileUpload and PricingSection)

**Context:**
- Client component (`'use client'`)
- Receives `user` (User | null), `profile` (Profile | null) as props from the server component page
- If not logged in: show section title with login gate message
- If logged in: show collapsible textarea editor with save/upload/download buttons
- Real-time validation using `validateDictionary()` from `lib/custom-dict.ts`
- Pair count indicator shows `N / LIMIT 組對照`
- Fetches existing dictionary on mount via `GET /api/dictionary`
- Saves via `POST /api/dictionary`
- Upload CSV: file input that reads `.csv` into textarea
- Download CSV: export textarea content as `.csv` file
- Style must match the existing page (Tailwind, same color palette as FileUpload and PricingSection)
- The section header uses `material-symbols-outlined` for the icon (project already loads this font)

**Step 1: Create the component**

Create `components/CustomDictEditor.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import { validateDictionary, parseDictionary, getDictPairLimit, type DictValidationError } from '@/lib/custom-dict';
import { isPaidUser } from '@/lib/auth';

interface CustomDictEditorProps {
  user: User | null;
  profile: Profile | null;
}

export default function CustomDictEditor({ user, profile }: CustomDictEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [errors, setErrors] = useState<DictValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const licenseType = profile?.license_type ?? 'free';
  const pairLimit = getDictPairLimit(licenseType);
  const pairs = parseDictionary(content);
  const pairCount = pairs.length;
  const isOverLimit = pairCount > pairLimit;
  const hasUnsavedChanges = content !== savedContent;

  // Fetch existing dictionary on mount
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    fetch('/api/dictionary')
      .then((res) => res.json())
      .then((data) => {
        if (data.content) {
          setContent(data.content);
          setSavedContent(data.content);
        }
      })
      .catch((err) => console.error('Error loading dictionary:', err))
      .finally(() => setIsLoading(false));
  }, [user]);

  // Validate on content change
  useEffect(() => {
    if (!content.trim()) {
      setErrors([]);
      return;
    }
    const validationErrors = validateDictionary(content);
    setErrors(validationErrors);
  }, [content]);

  // Clear save message after 3 seconds
  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  const handleSave = useCallback(async () => {
    if (errors.length > 0 || isOverLimit) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveMessage({ type: 'error', text: data.error || '儲存失敗' });
        return;
      }

      setSavedContent(content);
      setSaveMessage({ type: 'success', text: `已儲存 ${data.pairCount} 組對照` });
    } catch (error) {
      setSaveMessage({ type: 'error', text: '網路錯誤，請稍後再試' });
    } finally {
      setIsSaving(false);
    }
  }, [content, errors, isOverLimit]);

  const handleUploadCSV = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text);
    };
    reader.readAsText(file, 'utf-8');

    // Reset file input so same file can be re-selected
    e.target.value = '';
  }, []);

  const handleDownloadCSV = useCallback(() => {
    const blob = new Blob([content], { type: 'text/csv; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-dictionary.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  // Login gate
  if (!user) {
    return (
      <section className="py-4">
        <button
          className="w-full flex items-center justify-between py-3 text-left"
          disabled
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-400">book_2</span>
            <h3 className="text-lg font-semibold text-gray-400">自訂字典對照</h3>
          </div>
        </button>
        <div className="mt-2 p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
          <p className="text-gray-500 text-sm">登入後即可使用自訂字典功能</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4">
      {/* Collapsible Header */}
      <button
        className="w-full flex items-center justify-between py-3 text-left group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-600">book_2</span>
          <h3 className="text-lg font-semibold text-gray-800">自訂字典對照</h3>
          {pairCount > 0 && !isExpanded && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {pairCount} 組
            </span>
          )}
        </div>
        <span className="material-symbols-outlined text-gray-400 group-hover:text-gray-600 transition-colors">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="mt-2 space-y-3">
          {/* Textarea */}
          <div className="relative">
            {isLoading ? (
              <div className="w-full h-48 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center">
                <span className="text-sm text-gray-400">載入中...</span>
              </div>
            ) : (
              <textarea
                className="w-full h-48 p-4 bg-white rounded-xl border border-gray-200 text-sm font-mono text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-y"
                placeholder={`代码,程式\n内存,記憶體\n信息,訊息`}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            )}
          </div>

          {/* Pair count + limit indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className={`${isOverLimit ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
              {pairCount} / {pairLimit.toLocaleString()} 組對照
            </span>
            {hasUnsavedChanges && !isSaving && (
              <span className="text-gray-400">未儲存的變更</span>
            )}
          </div>

          {/* Over-limit warning */}
          {isOverLimit && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-base mt-0.5">warning</span>
              <span>
                免費版最多 {pairLimit} 組對照，升級可解鎖更多。
                <a href="#pricing" className="underline ml-1 font-medium">查看方案</a>
              </span>
            </div>
          )}

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-1">
              {errors.slice(0, 5).map((err, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-red-400 text-base mt-0.5">error</span>
                  <span>{err.message}</span>
                </div>
              ))}
              {errors.length > 5 && (
                <div className="text-red-500 text-xs mt-1">...還有 {errors.length - 5} 個錯誤</div>
              )}
            </div>
          )}

          {/* Save message */}
          {saveMessage && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              saveMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <span className="material-symbols-outlined text-base">
                {saveMessage.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {saveMessage.text}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || errors.length > 0 || isOverLimit || !hasUnsavedChanges}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isSaving || errors.length > 0 || isOverLimit || !hasUnsavedChanges
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover text-white'
              }`}
            >
              {isSaving ? '儲存中...' : '儲存'}
            </button>
            <button
              onClick={handleUploadCSV}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              匯入 CSV
            </button>
            <button
              onClick={handleDownloadCSV}
              disabled={!content.trim()}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-1 ${
                !content.trim()
                  ? 'bg-white border border-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-base">download</span>
              匯出 CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}
    </section>
  );
}
```

**Step 2: Add component to homepage**

In `app/page.tsx`, add import and place between FileUpload and PricingSection:

```tsx
import CustomDictEditor from '@/components/CustomDictEditor';

// ... inside the return JSX, after <FileUpload /> and before <PricingSection>:
<CustomDictEditor user={user} profile={profile} />
```

**Step 3: Run the dev server and manually verify**

Run: `npm run dev`
- Visit http://localhost:3000
- Verify the "自訂字典對照" section appears between file upload and pricing
- If not logged in: see "登入後即可使用自訂字典功能" message
- If logged in: expand the section, type pairs, see validation in real-time

**Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add components/CustomDictEditor.tsx app/page.tsx
git commit -m "feat: add custom dictionary editor UI component"
```

---

### Task 7: Update Pricing Section — Remove "Coming Soon" Label

**Files:**
- Modify: `components/PricingSection.tsx:71` (remove "coming soon" text)

**Context:**
- The Monthly tier feature list currently shows: `自訂字典對照 (coming soon)`
- Now that the feature is implemented, remove the "(coming soon)" label

**Step 1: Update PricingSection**

In `components/PricingSection.tsx`, change line 71 from:

```tsx
自訂字典對照 <span className="text-xs text-gray-400">(coming soon)</span>
```

to:

```tsx
自訂字典對照
```

Also add "自訂字典對照（5 組）" to the Free tier features list, so users know they get some access.

**Step 2: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add components/PricingSection.tsx
git commit -m "feat: update pricing section with custom dictionary feature"
```

---

### Task 8: End-to-End Manual Testing & Final Verification

**No files to create/modify — this is a verification task.**

**Test Plan:**

1. **Anonymous user view:**
   - Visit http://localhost:3000 (not logged in)
   - Verify "自訂字典對照" section shows login gate
   - Upload and convert a file — should work normally (no custom dict)

2. **Logged-in free user:**
   - Log in
   - Expand dictionary editor
   - Type `代码,程式` — verify no errors, counter shows "1 / 5"
   - Type 6 pairs — verify amber warning with upgrade CTA
   - Click Save — verify success message
   - Reload page — verify dictionary is loaded back
   - Upload a file containing "代码" — verify it converts to "程式" not "代碼"
   - Click "匯出 CSV" — verify download works
   - Click "匯入 CSV" — verify import works

3. **Validation testing:**
   - Type a line without comma → see error
   - Type a line with multiple commas → see error
   - Type duplicate keys → see error
   - Fix errors → errors disappear, save button enabled

4. **Build verification:**
   - Run `npm run build` — verify no build errors
   - Run `npx jest --ci --coverage` — verify all tests pass with 80%+ coverage

**Step 1: Run full test suite**

Run: `npx jest --ci --coverage`
Expected: All tests PASS, coverage >= 80%

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "test: verify custom dictionary feature end-to-end"
```
