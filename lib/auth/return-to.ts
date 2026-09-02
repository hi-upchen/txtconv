/** Cookie that remembers which page started a login. */
export const LOGIN_RETURN_TO_COOKIE = 'login_return_to';

/** One-shot cookie set right after a login succeeds. Its value is the login method. */
export const LOGIN_JUST_SUCCEEDED_COOKIE = 'login_just_succeeded';

/** Ten minutes. Long enough to read an email and come back. */
export const LOGIN_RETURN_TO_MAX_AGE_SECONDS = 600;

/** One minute. The next page load reads and clears it. */
export const LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS = 60;

/** Cookie that remembers which login method the user picked, so the server-side redirect can label it right. */
export const LOGIN_METHOD_HINT_COOKIE = 'login_method_hint';

/** Ten minutes, same lifetime as login_return_to. */
export const LOGIN_METHOD_HINT_MAX_AGE_SECONDS = 600;

/**
 * Returns a safe in-site path to send the user back to after login.
 * Anything that is not a plain in-site path becomes "/".
 *
 * Accepted: starts with one "/", second character is not "/" or "\",
 * no "://", no whitespace or control characters, and not under
 * /auth or /api. The "\" check matters because browsers rewrite
 * "/\evil.com" to "//evil.com".
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.length > 1 && (value[1] === '/' || value[1] === '\\')) return '/';
  if (value.includes('://')) return '/';
  if (/[\s\x00-\x1f\x7f]/.test(value)) return '/';
  if (value === '/auth' || value.startsWith('/auth/')) return '/';
  if (value === '/api' || value.startsWith('/api/')) return '/';
  return value;
}
