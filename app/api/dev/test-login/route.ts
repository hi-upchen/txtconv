import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { TEST_USER_ID } from '@/lib/test-user';

/**
 * DEV ONLY: Bypass login for testing with Chrome MCP.
 * Creates a mock session with test user ID and custom dictionary.
 *
 * Security guards:
 * 1. NODE_ENV must not be 'production'
 * 2. ENABLE_TEST_LOGIN env var must be 'true'
 *
 * Note: Custom dictionary is loaded client-side via getTestSession() in
 * client-converter.ts when it detects the test-session cookie.
 */
export async function GET(request: NextRequest) {
  // Security guard 1: Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test login is disabled in production' },
      { status: 403 }
    );
  }

  // Security guard 2: Require explicit opt-in
  if (process.env.ENABLE_TEST_LOGIN !== 'true') {
    return NextResponse.json(
      { error: 'Test login not enabled. Set ENABLE_TEST_LOGIN=true in .env' },
      { status: 403 }
    );
  }

  try {
    // Set a mock session cookie with test user ID
    const cookieStore = await cookies();

    // Create mock session data
    // license=free lets a test reach the paid-upgrade path.
    // The checkout page sends lifetime users home. Any other value means lifetime.
    const license = request.nextUrl.searchParams.get('license') === 'free' ? 'free' : 'lifetime';

    const mockSession = {
      user: {
        id: TEST_USER_ID,
        email: 'test@txtconv.local',
        role: 'authenticated',
      },
      license,
      expires_at: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Set session cookie (will be read by client-side code)
    cookieStore.set('test-session', JSON.stringify(mockSession), {
      httpOnly: false, // Allow client-side access for testing
      secure: false,   // Allow HTTP for localhost
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    // Redirect to home page
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  } catch (error) {
    console.error('Test login error:', error);
    return NextResponse.json(
      { error: 'Failed to create test session' },
      { status: 500 }
    );
  }
}
