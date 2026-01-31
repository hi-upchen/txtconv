/**
 * Get the base URL for redirects.
 * Priority: NEXT_PUBLIC_APP_URL env var > x-forwarded-host header > request origin
 */
export function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${forwardedHost}`;
  }
  const { origin } = new URL(request.url);
  return origin;
}
