import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/url';
import { ensureProfileLinked } from '@/lib/actions/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';
  const baseUrl = getBaseUrl(request);

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Link auth user to existing profile (or create one)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await ensureProfileLinked(user.id, user.email);
      }

      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
