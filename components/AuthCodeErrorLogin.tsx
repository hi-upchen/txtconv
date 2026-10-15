'use client';

import { useEffect, useRef, useState } from 'react';
import LoginPanel from './LoginPanel';
import { LOGIN_RETURN_TO_COOKIE, sanitizeReturnTo } from '@/lib/auth/return-to';
import { readCookie } from '@/lib/auth/browser-cookies';
import { trackLoginFailed } from '@/lib/analytics';

const HEADING = '改用驗證碼登入';
const DESCRIPTION = '輸入 Email 後，我們會寄 6 位數驗證碼給你，直接在這裡輸入即可，不必再點連結。';

/**
 * Shown on the "link expired" page, where an expired or already-used email link lands.
 * Reports the failed login once, then offers the code login instead.
 *
 * The ref stops a second report when React runs the effect twice in development.
 */
export default function AuthCodeErrorLogin() {
  const [returnTo, setReturnTo] = useState('/');
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current) return;
    reported.current = true;

    trackLoginFailed('magic_link', 'link_invalid_or_expired');
    setReturnTo(sanitizeReturnTo(readCookie(LOGIN_RETURN_TO_COOKIE)));
  }, []);

  return (
    <div className="w-full max-w-[340px] text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <LoginPanel returnTo={returnTo} heading={HEADING} description={DESCRIPTION} />
    </div>
  );
}
