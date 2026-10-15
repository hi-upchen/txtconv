import { cookies } from 'next/headers';
import type { LoginMethod } from '@/types/gtm';
import {
  LOGIN_RETURN_TO_COOKIE,
  LOGIN_JUST_SUCCEEDED_COOKIE,
  LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS,
  sanitizeReturnTo,
} from '@/lib/auth/return-to';

/**
 * Finishes a server-side login and returns the in-site path to redirect to.
 *
 * Destination order:
 * 1. the "next" query parameter, when present
 * 2. the login_return_to cookie, when present
 * 3. "/"
 * Every candidate goes through sanitizeReturnTo, so an unsafe value
 * becomes "/" instead of falling through to the next candidate.
 *
 * Method: fixedMethod wins when the caller passes one.
 * - /auth/finish passes 'email_code' or 'google'. Both logins finish in the browser.
 * - /auth/confirm passes 'magic_link'. Every request it serves comes from an email link.
 * - /auth/callback passes nothing. It only serves email links, so the label is 'magic_link'.
 *
 * Side effects: clears login_return_to and sets a
 * one-minute cookie login_just_succeeded=<method>. The next page reads
 * that cookie and reports the login_succeeded event. The cookie must stay
 * readable from JavaScript, so it is not HttpOnly.
 */
export async function finishLoginRedirect(
  nextParam: string | null,
  fixedMethod?: LoginMethod
): Promise<string> {
  const cookieStore = await cookies();

  const destination = sanitizeReturnTo(nextParam || cookieStore.get(LOGIN_RETURN_TO_COOKIE)?.value);

  const method: LoginMethod = fixedMethod ?? 'magic_link';

  cookieStore.delete(LOGIN_RETURN_TO_COOKIE);
  cookieStore.set(LOGIN_JUST_SUCCEEDED_COOKIE, method, {
    maxAge: LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return destination;
}
