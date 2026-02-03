# Blob Cleanup Cron Job Design

## Overview

Implement a Vercel Cron Job to automatically clean up old blob files, preventing storage accumulation.

## Cleanup Rules

- Delete blobs older than **3 days**
- **Exclude** blobs with pathname starting with `dictionaries/` (user custom dictionaries)

## Architecture

```
Vercel Scheduler (3am UTC daily)
       ↓
GET /api/cron/cleanup-blobs
       ↓
Verify CRON_SECRET header
       ↓
List all blobs (paginated)
       ↓
Filter: uploadedAt < 3 days ago AND NOT pathname.startsWith("dictionaries/")
       ↓
Delete matching blobs
       ↓
Log: "Deleted X blobs"
```

## Implementation

### 1. New Files

**`vercel.json`**
```json
{
  "crons": [{
    "path": "/api/cron/cleanup-blobs",
    "schedule": "0 3 * * *"
  }]
}
```

**`/app/api/cron/cleanup-blobs/route.ts`**
- Verify `CRON_SECRET` header (Vercel auto-sends this for cron jobs)
- List all blobs using `@vercel/blob` `list()` with pagination
- Filter blobs by age and path
- Delete matching blobs using `del()`
- Log count of deleted blobs

### 2. Files to Modify

**`/app/api/convert/route.ts`**
- Remove import: `import { archiveOriginalFile } from '@/lib/archive';`
- Remove lines 70-73 (archive call that's never executed)

### 3. Files to Delete

**`/lib/archive.ts`**
- Dead code - `archiveOriginalFile` is never called because the UI always provides `blobUrl`

### 4. Environment

`CRON_SECRET` - Vercel automatically sets this for cron job authentication.

## Blob Paths Reference

| Source | Path Pattern | Cleanup? |
|--------|--------------|----------|
| Client upload (`/api/upload`) | `{filename}-{randomSuffix}` | Yes |
| Dictionaries | `dictionaries/{userId}.csv` | No |

## Security

- Cron endpoint protected by `CRON_SECRET` header verification
- Only Vercel's scheduler can trigger the cleanup
