# Test Login UI Integration Design

## Goal

Make the UI reflect test login status so all login-required features can be tested via Chrome MCP without real authentication.

## Problem

Currently:
- Test login sets `test-session` cookie
- `client-converter.ts` detects cookie → loads test dictionary ✅
- UI components receive `user`/`profile` from server-side Supabase auth → shows "Login" button ❌

## Solution

Modify server-side auth functions to detect test session cookie and return mock user/profile.

## Architecture

### Modified Functions

**`getAuthUser()` in `lib/actions/auth.ts`:**
1. Check security guards: `NODE_ENV !== 'production'` AND `ENABLE_TEST_LOGIN === 'true'`
2. Read `test-session` cookie via `cookies()` from `next/headers`
3. If valid test session, return mock `User` object
4. Otherwise, fall through to Supabase auth

**`getProfile()` in `lib/actions/auth.ts`:**
1. If `userId === TEST_USER_ID` and dev mode, return mock `Profile`
2. Otherwise, fall through to Supabase query

### Mock Objects

**Mock User:**
```typescript
{
  id: TEST_USER_ID,
  email: 'test@txtconv.local',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
}
```

**Mock Profile:**
```typescript
{
  id: TEST_USER_ID,
  email: 'test@txtconv.local',
  license_type: 'lifetime',
  custom_dict_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}
```

### Security Guards

Same as existing test-login route:
- `NODE_ENV !== 'production'` - blocks in production
- `ENABLE_TEST_LOGIN === 'true'` - requires explicit opt-in

## Files to Modify

- `lib/actions/auth.ts` - Add test session detection

## Testing Checklist

1. Navigate to `/api/dev/test-login`
2. UI shows logged-in state (user email in header)
3. Shows "Lifetime Plan" badge
4. CustomDictEditor shows "10 / 10000 組對照"
5. Dictionary editor is enabled (not disabled)
6. Navigate to `/api/dev/test-logout`
7. UI returns to guest state
8. Shows "Login" button
9. CustomDictEditor shows "0 / 5 組對照"

## Implementation

Single task: Modify `lib/actions/auth.ts` to detect test session.
