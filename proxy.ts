/**
 * Next.js proxy (formerly middleware.ts — renamed because Next.js 16
 * deprecates the middleware convention). Runs on every matched request to
 * refresh the Supabase auth session cookie before the page renders.
 * Unlike middleware, proxy always runs on the Node.js runtime.
 */
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Refreshes the Supabase session for every non-static request.
 *
 * @param request - The incoming request to pass through Supabase session refresh
 * @returns The response with refreshed auth cookies attached
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
