import { cookies } from 'next/headers';
import type { LoginMethod } from '@/types/gtm';
import {
  LOGIN_RETURN_TO_COOKIE,
  LOGIN_JUST_SUCCEEDED_COOKIE,
  LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS,
  LOGIN_METHOD_HINT_COOKIE,
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
 * Method: fixedMethod wins when the caller passes one. The confirm route
 * always passes 'magic_link', because every request it serves comes from
 * an email link. The callback route passes nothing, so the method comes
 * from the login_method_hint cookie instead: 'google' when the panel set
 * it right before the Google button redirected, 'magic_link' otherwise.
 * This does not use the auth user's app_metadata.provider, because that
 * field records the provider used at the account's first sign-up, not
 * the provider used for this login.
 *
 * Side effects: clears login_return_to and login_method_hint, and sets a
 * one-minute cookie login_just_succeeded=<method>. The next page reads
 * that cookie and reports the login_succeeded event. The cookie must stay
 * readable from JavaScript, so it is not HttpOnly.
 */
export async function finishLoginRedirect(
  nextParam: string | null,
  fixedMethod?: LoginMethod
): Promise<string> {
  const cookieStore = await cookies();

  let destination = '/';
  if (nextParam) {
    destination = sanitizeReturnTo(nextParam);
  } else {
    const remembered = cookieStore.get(LOGIN_RETURN_TO_COOKIE)?.value ?? null;
    if (remembered) destination = sanitizeReturnTo(remembered);
  }

  const hint = cookieStore.get(LOGIN_METHOD_HINT_COOKIE)?.value;
  const method: LoginMethod = fixedMethod ?? (hint === 'google' ? 'google' : 'magic_link');

  cookieStore.delete(LOGIN_RETURN_TO_COOKIE);
  cookieStore.delete(LOGIN_METHOD_HINT_COOKIE);
  cookieStore.set(LOGIN_JUST_SUCCEEDED_COOKIE, method, {
    maxAge: LOGIN_JUST_SUCCEEDED_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return destination;
}
