import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/url';
import { ensureProfileLinked } from '@/lib/actions/auth';
import { finishLoginRedirect } from '@/lib/auth/finish-login';

/**
 * OAuth and email-link landing route.
 * Exchanges the code for a session, links the profile,
 * then sends the user back to the page that started the login.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const baseUrl = getBaseUrl(request);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Link auth user to existing profile (or create one)
      const user = data?.user;
      if (user?.email) {
        await ensureProfileLinked(user.id, user.email);
      }

      // The login method comes from the login_method_hint cookie inside
      // finishLoginRedirect, not from the exchanged user's account data.
      const destination = await finishLoginRedirect(searchParams.get('next'));

      return NextResponse.redirect(`${baseUrl}${destination}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
