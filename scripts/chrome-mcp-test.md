# Chrome MCP Testing Guide

## Prerequisites

1. Dev server running: `npm run dev`
2. `ENABLE_TEST_LOGIN=true` in `.env`
3. Chrome MCP connected

## Test Flow

### 1. Login as Test User

```
navigate_page → http://localhost:3000/api/dev/test-login
```

This will:
- Set test session cookie
- Pre-load custom dictionary with 10 entries
- Redirect to home page

### 2. Verify Logged In State

```
take_snapshot
```

Look for:
- Custom dict section should show "10 / 10000 組對照"
- User should appear logged in

### 3. Test Custom Dictionary Conversion

Upload a file containing: `软件测试`

Expected result: `軟體程式測試`
(NOT `軟體測試` which would be the default OpenCC conversion)

### 4. Test Different Encodings

| Encoding | Test File | Expected |
|----------|-----------|----------|
| UTF-8 | `软件测试` | `軟體程式測試` |
| GBK | GBK bytes for `软件测试` | `軟體程式測試` |
| Big5 | Big5 bytes for `這是測試` | `這是測試` |

### 5. Logout

```
navigate_page → http://localhost:3000/api/dev/test-logout
```

### Verification Checklist

- [ ] Test login redirects to home page
- [ ] Custom dict is loaded (shows 10 entries)
- [ ] Conversion uses custom dict, not OpenCC defaults
- [ ] UTF-8, GBK, Big5 encodings all work
- [ ] Test logout clears session
