'use client';

import { useEffect, useRef, useState } from 'react';
import LoginPanel from './LoginPanel';
import { LOGIN_RETURN_TO_COOKIE, sanitizeReturnTo } from '@/lib/auth/return-to';
import { readCookie } from '@/lib/auth/browser-cookies';
import { trackLoginFailed } from '@/lib/analytics';

/**
 * Shown on the "link expired" page.
 * Reports the failed email-link login once, then offers the code flow.
 * The return path comes from the cookie the earlier attempt left behind,
 * so a retry still lands on the page the user started from.
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
      <LoginPanel
        returnTo={returnTo}
        heading="改用驗證碼登入"
        description="輸入 Email 後，我們會寄 6 位數驗證碼給你，直接在這裡輸入即可，不必再點連結。"
      />
    </div>
  );
}
