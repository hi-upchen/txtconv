# Custom Dictionary Feature Design

## Goal

Allow users to provide custom simplified-to-traditional Chinese translation pairs that override the built-in opencc dictionary. Free users get 5 pairs, paid users (monthly/lifetime) get 10,000.

## Architecture

### Conversion Pipeline (Placeholder Approach)

The custom dictionary must take priority over opencc's built-in mappings. To prevent opencc from re-converting user-specified traditional output:

1. **Pre-process**: Scan text for user dictionary simplified keys (sorted by length descending for longest-match-first). Replace matches with null-byte-wrapped placeholders (`\x00DICT_0\x00`, `\x00DICT_1\x00`, etc.)
2. **OpenCC convert**: Run standard `cn → twp` conversion. ASCII/null-byte placeholders pass through untouched.
3. **Post-process**: Replace placeholders with user's specified traditional values.

If no custom dictionary exists, skip placeholder logic entirely (current behavior preserved).

### Data Flow

```
User edits textarea → POST /api/dictionary → Vercel Blob (dictionaries/{userId}.csv) → profile.custom_dict_url updated
User uploads file → POST /api/convert → fetch custom dict from Blob → placeholder pre-process → opencc → placeholder post-process → SSE stream result
```

### Storage

- Dictionary CSV stored in **Vercel Blob** at path `dictionaries/{userId}.csv`
- One file per user, overwritten on each save
- `profiles` table gets new column: `custom_dict_url TEXT NULL`

## UI/UX

### Placement

Collapsible section on homepage, between File Upload and Pricing sections.

### Editor Component (`CustomDictEditor`)

- **Collapsed by default** — section title "自訂字典對照" with expand toggle
- **Textarea-style editor** showing dictionary content (one pair per line: `simplified,traditional`)
- **Placeholder text**: `代码,程式\n内存,記憶體`
- **Action buttons**: Upload CSV, Download CSV, Save
- **Pair count indicator**: "3 / 5 組對照" (free) or "42 / 10,000 組對照" (paid)
- **Real-time validation** — invalid lines get inline warning messages below textarea
- **Login gate** — if not logged in, show section header with "登入後即可使用" message + login button

### Validation Rules (Client + Server)

| Condition | Message |
|-----------|---------|
| No comma in line | 第 N 行格式錯誤：缺少逗號 |
| Multiple commas | 第 N 行格式錯誤：只能有一個逗號 |
| Empty left or right | 第 N 行格式錯誤：簡體和繁體都不能為空 |
| Duplicate simplified key | 第 N 行重複：'X' 已在第 M 行定義 |
| Blank lines | Silently skipped (allowed) |

### Limit Behavior

- Free: 5 pairs. Paid (monthly/lifetime): 10,000 pairs.
- When exceeding limit: amber warning + upgrade CTA link ("免費版最多 5 組對照，升級可解鎖更多")
- Server enforces limit on save. Conversion uses first N pairs if somehow over limit (defensive).
- If user downgrades: keep dictionary, apply first 5 pairs only during conversion, show warning in editor.

## API Endpoints

### `GET /api/dictionary`

- **Auth**: Required (session cookie)
- **Response**: `{ content: string, pairCount: number }` or `{ content: "", pairCount: 0 }`
- **Logic**: Read `profile.custom_dict_url`, fetch from Vercel Blob, return content

### `POST /api/dictionary`

- **Auth**: Required (session cookie)
- **Body**: `{ content: string }`
- **Validation**: Format check + pair count limit (based on license_type)
- **Logic**: Upload to Vercel Blob at `dictionaries/{userId}.csv`, update `profile.custom_dict_url`
- **Response**: `{ success: true, pairCount: number }` or `{ error: string }`

### Modified `POST /api/convert`

- After reading file, check authenticated user for `custom_dict_url`
- Fetch dictionary from Vercel Blob, parse pairs
- Apply placeholder-based conversion pipeline
- If blob fetch fails: log error, proceed without custom dict (graceful degradation)

## Database Changes

```sql
ALTER TABLE profiles ADD COLUMN custom_dict_url TEXT NULL;
```

## New Files

- `components/CustomDictEditor.tsx` — Client component for dictionary editing UI
- `app/api/dictionary/route.ts` — GET/POST endpoints for dictionary CRUD
- `lib/custom-dict.ts` — Dictionary parsing, validation, and placeholder conversion logic

## Modified Files

- `app/page.tsx` — Add `CustomDictEditor` between FileUpload and PricingSection
- `lib/opencc.ts` — Add `convertFileWithCustomDict()` function
- `app/api/convert/route.ts` — Fetch user's custom dict and pass to conversion
- `types/user.ts` — Add `custom_dict_url` to Profile type

## Tech Stack

- Vercel Blob (existing) for dictionary file storage
- Supabase (existing) for profile metadata
- opencc-js (existing) for base conversion
