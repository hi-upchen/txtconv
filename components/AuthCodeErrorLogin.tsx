'use client';

import { useEffect, useRef, useState } from 'react';
import LoginPanel from './LoginPanel';
import { LOGIN_RETURN_TO_COOKIE, LOGIN_METHOD_HINT_COOKIE, sanitizeReturnTo } from '@/lib/auth/return-to';
import { readCookie, deleteCookie } from '@/lib/auth/browser-cookies';
import { trackLoginFailed } from '@/lib/analytics';

const MAGIC_LINK_HEADING = '改用驗證碼登入';
const MAGIC_LINK_DESCRIPTION =
  '輸入 Email 後，我們會寄 6 位數驗證碼給你，直接在這裡輸入即可，不必再點連結。';

const GOOGLE_HEADING = 'Google 登入未完成';
const GOOGLE_DESCRIPTION =
  'Google 登入被取消或未完成。可以重新點擊使用 Google 登入，或改用 Email 收取 6 位數驗證碼登入。';

/**
 * Shown on the "link expired" page.
 * Reports the failed login once, then offers a way to try again.
 *
 * Two logins land here: an expired or already-used email link, and an
 * aborted Google sign-in (the user cancelled the consent screen, so
 * Supabase redirects back with no code). The login_method_hint cookie
 * set right before the login started tells them apart. It is deleted
 * right after reading, so a later real magic-link failure is not
 * mislabeled as an aborted Google sign-in.
 */
export default function AuthCodeErrorLogin() {
  const [returnTo, setReturnTo] = useState('/');
  const [isGoogleFailure, setIsGoogleFailure] = useState(false);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;

    const methodHint = readCookie(LOGIN_METHOD_HINT_COOKIE);
    deleteCookie(LOGIN_METHOD_HINT_COOKIE);
    const wasGoogle = methodHint === 'google';

    trackLoginFailed(
      wasGoogle ? 'google' : 'magic_link',
      wasGoogle ? 'oauth_cancelled_or_failed' : 'link_invalid_or_expired'
    );

    setIsGoogleFailure(wasGoogle);
    setReturnTo(sanitizeReturnTo(readCookie(LOGIN_RETURN_TO_COOKIE)));
  }, []);

  const heading = isGoogleFailure ? GOOGLE_HEADING : MAGIC_LINK_HEADING;
  const description = isGoogleFailure ? GOOGLE_DESCRIPTION : MAGIC_LINK_DESCRIPTION;

  return (
    <div className="w-full max-w-[340px] text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <LoginPanel returnTo={returnTo} heading={heading} description={description} />
    </div>
  );
}
