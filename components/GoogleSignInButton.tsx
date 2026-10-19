'use client';

import { useEffect, useRef } from 'react';
import {
  ensureGoogleInitialized,
  isInAppBrowser,
  registerGoogleCredentialHandler,
} from '@/lib/auth/google-identity';

interface GoogleSignInButtonProps {
  /** Runs when the user clicks the button. Google's popup opens after this. */
  onStart: () => void;
  /** Runs with Google's ID token. Also passes the raw nonce for the login step. */
  onCredential: (idToken: string, rawNonce: string) => void;
  /** Runs when Google sign-in cannot work here. The caller can then hide this option. */
  onUnavailable: () => void;
}

/**
 * Renders Google's own "Sign in with Google" button.
 * Google draws the button inside this element and runs the popup itself.
 *
 * The callbacks are stored in a ref, so Google always reaches the latest props.
 * Google has one page-wide setup. This button registers a handler for tokens
 * and removes it on unmount. The newest registered button gets each token.
 */
export default function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    let cancelled = false;

    // Google refuses sign-in inside app browsers, so skip the script there.
    if (isInAppBrowser(navigator.userAgent)) {
      propsRef.current.onUnavailable();
      return;
    }

    const unregister = registerGoogleCredentialHandler((idToken, rawNonce) =>
      propsRef.current.onCredential(idToken, rawNonce)
    );

    (async () => {
      try {
        await ensureGoogleInitialized();
        const container = containerRef.current;
        const gis = window.google?.accounts.id;
        if (!gis) throw new Error('Google Identity is missing after load');
        if (cancelled || !container) return;

        gis.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'zh_TW',
          width: String(Math.min(container.offsetWidth || 292, 400)),
          click_listener: () => propsRef.current.onStart(),
        });
      } catch {
        // Any failure leaves an empty box, so tell the caller to hide it.
        if (!cancelled) propsRef.current.onUnavailable();
      }
    })();

    return () => {
      cancelled = true;
      unregister();
    };
  }, []);

  return <div ref={containerRef} data-testid="google-signin-button" className="w-full min-h-[44px] flex justify-center" />;
}
