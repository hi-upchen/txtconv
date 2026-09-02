/**
 * Tiny document.cookie helpers for the login flow.
 * All cookies are site-wide (Path=/) and SameSite=Lax.
 * Secure is added on https so production cookies never travel in clear text.
 */

/** Reads one cookie by exact name. Returns null when it is not set or malformed. */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      // A stray "%" in the raw value makes decodeURIComponent throw.
      // Treat a malformed value the same as a missing cookie.
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Writes one cookie that expires after maxAgeSeconds. */
export function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

/** Removes one cookie right away. */
export function deleteCookie(name: string): void {
  writeCookie(name, '', 0);
}
