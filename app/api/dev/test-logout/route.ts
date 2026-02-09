import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * DEV ONLY: Clear test session.
 */
export async function GET() {
  // Security guard: Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test logout is disabled in production' },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.delete('test-session');

  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
}
