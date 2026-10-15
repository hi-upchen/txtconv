/**
 * Helpers for Google's own "Sign in with Google" button.
 *
 * The button logs in on this site's origin.
 * Google's consent screen then names this site.
 */

/** Public OAuth client id. It appears in every page that shows the button. */
export const GOOGLE_CLIENT_ID =
  '797135189931-45aim2iq1khsikfv7gu9jvdjknh623sa.apps.googleusercontent.com';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let loading: Promise<void> | null = null;

/**
 * Tells whether the page runs inside an app's built-in browser.
 * Google refuses sign-in there. Covers LINE, Facebook, Instagram and Threads.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return (
    /\bLine\//.test(userAgent) ||
    /FBAN|FBAV/.test(userAgent) ||
    /Instagram/.test(userAgent) ||
    /Barcelona/.test(userAgent)
  );
}

/**
 * Loads the Google Identity script once per page.
 * Every caller shares one promise. A failed load clears it so a later call retries.
 */
export function loadGoogleIdentity(): Promise<void> {
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('Google Identity script failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Makes a one-time value that ties Google's ID token to this login attempt.
 * Google receives the SHA-256 hash. Supabase receives the raw value and checks it.
 */
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: toHex(digest) };
}
