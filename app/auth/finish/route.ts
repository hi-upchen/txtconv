import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/url';
import { ensureProfileLinked } from '@/lib/actions/auth';
import { finishLoginRedirect } from '@/lib/auth/finish-login';

/**
 * Landing route for the email code login.
 * The code is checked in the browser, which already holds the new session.
 * This route links the profile and sends the user back, like /auth/callback.
 *
 * Doing this on the server keeps every login path on one finish step.
 * The profile link also rides on the page load the user pays for anyway.
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

  const destination = await finishLoginRedirect(null, 'email_code');
  return NextResponse.redirect(`${baseUrl}${destination}`);
}
