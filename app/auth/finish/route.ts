import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/url';
import { ensureProfileLinked } from '@/lib/actions/auth';
import { finishLoginRedirect } from '@/lib/auth/finish-login';

/**
 * Landing route for logins that finish in the browser.
 * The email code and the Google button both leave a fresh session in the browser.
 * This route links the profile and sends the user back, like /auth/callback.
 *
 * Doing this on the server keeps every login path on one finish step.
 * The profile link also rides on the page load the user pays for anyway.
 *
 * The method parameter only labels the login for analytics.
 * Only "google" is honoured. Anything else counts as an email code login.
 */
export async function GET(request: Request) {
  const baseUrl = getBaseUrl(request);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    return NextResponse.redirect(`${baseUrl}/`);
  }

  if (user.email) {
    await ensureProfileLinked(user.id, user.email);
  }

  const method = new URL(request.url).searchParams.get('method') === 'google' ? 'google' : 'email_code';
  const destination = await finishLoginRedirect(null, method);
  return NextResponse.redirect(`${baseUrl}${destination}`);
}
