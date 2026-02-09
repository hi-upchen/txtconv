# txtconv - Simplified to Traditional Chinese Converter

## Project Overview

A Next.js web app that converts Simplified Chinese text files to Traditional Chinese (Taiwan). Supports multiple file formats (.txt, .srt, .csv, .xml) and various Chinese encodings.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL + Auth)
- **Conversion:** OpenCC-js (client-side), encoding-japanese (encoding detection)
- **Testing:** Jest + React Testing Library
- **Styling:** Tailwind CSS + Material Icons

## Key Features

- Client-side Chinese text conversion (no server upload needed)
- Multi-encoding support: UTF-8, GBK, GB2312, GB18030, Big5
- Custom dictionary for user-defined conversions
- Batch file conversion with progress tracking

## Development Setup

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit
```

## Chrome MCP Test Login

For testing logged-in features with Chrome MCP without real authentication:

### Setup

1. Add to `.env`:
   ```
   ENABLE_TEST_LOGIN=true
   ```

2. Start dev server: `npm run dev`

### Usage

**Login as test user:**
```
navigate_page → http://localhost:3000/api/dev/test-login
```

This will:
- Set test session cookie with mock user ID
- UI shows logged-in state (email `test@txtconv.local` in header)
- Custom dictionary section shows "PRO" badge with "10,000 組對照" limit
- Dictionary editor is enabled (can edit, import, export)
- Lifetime plan shows as "目前方案" (current plan)
- Pre-load custom dictionary (10 entries that differ from OpenCC defaults)

**Logout:**
```
navigate_page → http://localhost:3000/api/dev/test-logout
```

This will:
- Clear test session cookie
- UI returns to guest state ("Login" button in header)
- Custom dictionary shows "GUEST" badge with "5 組對照" limit
- Dictionary editor is disabled

### Test Custom Dictionary Verification

The test user has custom dictionary entries that **differ from OpenCC defaults**:

| Input (Simplified) | Custom Dict Output | OpenCC Default |
|-------------------|-------------------|----------------|
| 软件测试 | 軟體程式測試 | 軟體測試 |
| 硬件设备 | 硬體裝置設備 | 硬體裝置 |
| 网络信息 | 網際網路訊息通知 | 網路資訊 |

If you see the "Custom Dict Output", custom dictionary is working.
If you see "OpenCC Default", custom dictionary is NOT being applied.

### Security

- Test login only works when `NODE_ENV !== 'production'`
- Requires explicit `ENABLE_TEST_LOGIN=true` in environment
- Never deployed to production

## Key Files

| Path | Purpose |
|------|---------|
| `lib/client-converter.ts` | Client-side conversion logic |
| `lib/custom-dict.ts` | Custom dictionary parsing and application |
| `lib/test-user.ts` | Test user constants for dev testing |
| `lib/actions/auth.ts` | Server-side auth with test session detection |
| `components/FileUpload.tsx` | Main file upload and conversion UI |
| `app/api/dev/test-login/route.ts` | Dev-only test login endpoint |
| `app/api/dev/test-logout/route.ts` | Dev-only test logout endpoint |

## Encoding Detection

The app detects file encoding automatically using a scoring heuristic:

1. Try UTF-8 with strict mode
2. Try GBK, GB18030, Big5 and score results
3. Pick encoding with highest "Chinese-ness" score
4. Fall back to encoding-japanese for Japanese encodings

**Important:** GBK and Big5 can decode each other's bytes without errors but produce wrong characters. The scoring heuristic (`calculateChineseScore`) distinguishes them by checking for valid CJK character patterns.

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx jest __tests__/lib/client-converter.test.ts --verbose

# Run with coverage
npx jest --coverage
```

### Test Categories

- `__tests__/lib/client-converter.test.ts` - Encoding detection, custom dict integration
- `__tests__/lib/custom-dict.test.ts` - Dictionary parsing and validation
- `__tests__/lib/encoding.test.ts` - Server-side encoding utilities
- `__tests__/components/FileUpload.test.tsx` - UI component tests

## Common Tasks

### Test file conversion with different encodings

1. Use Chrome MCP to navigate to the app
2. Upload test files from `/tmp/` or create with specific encoding
3. Verify converted output matches expected Traditional Chinese

### Verify custom dictionary works

1. Login via `/api/dev/test-login`
2. Upload file containing `软件测试`
3. Expected output: `軟體程式測試` (not `軟體測試`)

### Debug encoding issues

1. Check browser console for detected encoding
2. The `readFileWithEncoding` function logs encoding scores
3. Compare scores between GBK and Big5 for ambiguous files
