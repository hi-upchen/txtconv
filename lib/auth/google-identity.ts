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

/** Milliseconds to wait for the Google script before giving up. */
const SCRIPT_LOAD_TIMEOUT_MS = 8000;

let loading: Promise<void> | null = null;

/**
 * Tells whether the page runs inside an app's built-in browser.
 * Google refuses sign-in there.
 * Covers LINE, Facebook, Instagram, Threads, WeChat, KakaoTalk, TikTok, X and Android WebView.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return (
    /\bLine\//.test(userAgent) ||
    /FBAN|FBAV/.test(userAgent) ||
    /Instagram/.test(userAgent) ||
    /Barcelona/.test(userAgent) ||
    /MicroMessenger/.test(userAgent) ||
    /KAKAOTALK/i.test(userAgent) ||
    /musical_ly|BytedanceWebview|TikTok/.test(userAgent) ||
    /Twitter for/.test(userAgent) ||
    /; wv\)/.test(userAgent)
  );
}

/**
 * Loads the Google Identity script once per page.
 * Every caller shares one promise.
 * A failed or stalled load clears the promise so a later call retries.
 */
export function loadGoogleIdentity(): Promise<void> {
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;

    const fail = (message: string) => {
      clearTimeout(timer);
      script.remove();
      loading = null;
      reject(new Error(message));
    };
    const timer = setTimeout(
      () => fail('Google Identity script timed out'),
      SCRIPT_LOAD_TIMEOUT_MS
    );

    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => fail('Google Identity script failed to load');
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

type CredentialHandler = (idToken: string, rawNonce: string) => void;

const handlers: CredentialHandler[] = [];
/** Google's sign-in API object, as the loaded script exposes it. */
type GoogleIdApi = NonNullable<Window['google']>['accounts']['id'];

let initializing: Promise<GoogleIdApi> | null = null;

/**
 * Adds a handler for Google's ID tokens and returns a function that removes it.
 * Only the most recently added handler that is still present gets each token.
 */
export function registerGoogleCredentialHandler(handler: CredentialHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index !== -1) handlers.splice(index, 1);
  };
}

/**
 * Loads the Google script, initializes it once per page, and returns Google's API.
 * Google keeps one global setup, so every panel shares one nonce.
 * The shared callback hands each token to the latest registered handler.
 * A failed setup clears the cache so a later call retries.
 */
export function ensureGoogleInitialized(): Promise<GoogleIdApi> {
  if (initializing) return initializing;

  initializing = (async () => {
    await loadGoogleIdentity();
    const gis = window.google?.accounts.id;
    if (!gis) throw new Error('Google Identity is missing after load');

    const nonce = await createNonce();
    gis.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: nonce.hashed,
      callback: ({ credential }) => {
        handlers[handlers.length - 1]?.(credential, nonce.raw);
      },
    });
    return gis;
  })();
  initializing.catch(() => {
    initializing = null;
  });
  return initializing;
}
