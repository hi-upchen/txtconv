'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  LOGIN_RETURN_TO_COOKIE,
  LOGIN_RETURN_TO_MAX_AGE_SECONDS,
  LOGIN_METHOD_HINT_COOKIE,
  LOGIN_METHOD_HINT_MAX_AGE_SECONDS,
  sanitizeReturnTo,
} from '@/lib/auth/return-to';
import { writeCookie, deleteCookie } from '@/lib/auth/browser-cookies';
import { assignLocation } from '@/lib/auth/navigation';
import { trackLoginStarted, trackLoginSucceeded, trackLoginFailed } from '@/lib/analytics';

interface LoginPanelProps {
  /** In-site path to return to after login. Defaults to the current page. */
  returnTo?: string;
  heading?: string;
  description?: string;
}

type Step = 'choose' | 'code';

/** Seconds the user must wait before asking for another code. Matches Supabase's one email per minute. */
const RESEND_COOLDOWN_SECONDS = 60;

const CODE_LENGTH = 6;

/** Base URL for auth redirects. Same rule as the rest of the app. */
function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
}

/**
 * Login panel with two ways in: Google, or a six-digit code sent by email.
 * Used inside the header dialog, the dictionary editor and the checkout page.
 *
 * Before either path starts it stores the return path in a cookie.
 * The server callback reads that cookie for Google and email-link logins.
 * The code path reads it here and does a full page load so server
 * components see the new session.
 */
export default function LoginPanel({
  returnTo,
  heading = '登入 / 註冊',
  description = '使用 Google 帳號一鍵登入，或以 Email 收取驗證碼',
}: LoginPanelProps) {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const emailId = useId();
  const codeId = useId();
  const codeInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  // Count the resend cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Put the cursor in the code field as soon as the code step appears.
  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  /** Where to send the user after login. Read lazily so it works during server render. */
  const resolveReturnTo = (): string =>
    sanitizeReturnTo(returnTo ?? window.location.pathname + window.location.search);

  const rememberReturnTo = () => {
    writeCookie(LOGIN_RETURN_TO_COOKIE, resolveReturnTo(), LOGIN_RETURN_TO_MAX_AGE_SECONDS);
  };

  const handleGoogle = async () => {
    setIsBusy(true);
    setErrorMessage('');
    rememberReturnTo();
    trackLoginStarted('google', window.location.pathname);
    // The callback route reads this to label the login. It cannot tell
    // the method from the account's provider, which only remembers the
    // provider used at sign-up, not the one used for this login.
    writeCookie(LOGIN_METHOD_HINT_COOKIE, 'google', LOGIN_METHOD_HINT_MAX_AGE_SECONDS);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${appBaseUrl()}/auth/callback` },
    });

    // On success the browser is already leaving for Google.
    if (error) {
      trackLoginFailed('google', error.code ?? 'oauth_error');
      setErrorMessage('Google 登入失敗，請改用下方 Email 驗證碼登入。');
      setIsBusy(false);
    }
  };

  /** Sends a code. isResend skips the login_started event. */
  const sendCode = async (address: string, isResend: boolean) => {
    setIsBusy(true);
    setErrorMessage('');
    rememberReturnTo();
    if (!isResend) trackLoginStarted('email_code', window.location.pathname);

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${appBaseUrl()}/auth/callback` },
    });

    if (error) {
      setErrorMessage(
        error.code === 'over_email_send_rate_limit'
          ? '寄送太頻繁，請一分鐘後再試。'
          : '驗證碼寄送失敗，請稍後再試。'
      );
    } else {
      setSentEmail(address);
      setCode('');
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
    setIsBusy(false);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear a stale Google hint so a later callback never mislabels this session.
    deleteCookie(LOGIN_METHOD_HINT_COOKIE);
    await sendCode(email, false);
  };

  const handleResend = async () => {
    if (cooldown > 0 || !sentEmail) return;
    await sendCode(sentEmail, true);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setErrorMessage('');

    const { error } = await supabase.auth.verifyOtp({
      email: sentEmail,
      token: code,
      type: 'email',
    });

    if (error) {
      trackLoginFailed('email_code', error.code ?? 'otp_verify_error');
      setErrorMessage('驗證碼錯誤或已過期，請重新輸入或重寄驗證碼。');
      setIsBusy(false);
      return;
    }

    trackLoginSucceeded('email_code', window.location.pathname);
    deleteCookie(LOGIN_RETURN_TO_COOKIE);
    assignLocation(resolveReturnTo());
  };

  const handleChangeEmail = () => {
    setStep('choose');
    setCode('');
    setErrorMessage('');
  };

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
  const primaryButtonClass = `w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors ${
    isBusy ? 'opacity-70 cursor-not-allowed' : ''
  }`;

  if (step === 'code') {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">輸入驗證碼</h2>
        <p className="text-sm text-gray-500 mb-5">
          我們已將 6 位數驗證碼寄至<br />
          <span className="font-medium text-gray-700">{sentEmail}</span>
        </p>
        <form onSubmit={handleVerify}>
          <label htmlFor={codeId} className="sr-only">驗證碼</label>
          <input
            id={codeId}
            ref={codeInputRef}
            className={`${inputClass} mb-3 text-center text-2xl tracking-[0.5em] font-mono`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={CODE_LENGTH}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
          {errorMessage && (
            <div role="alert" className="mb-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}
          <button className={primaryButtonClass} type="submit" disabled={isBusy || code.length !== CODE_LENGTH}>
            {isBusy ? '驗證中...' : '確認'}
          </button>
        </form>
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={isBusy || cooldown > 0}
            className="text-gray-500 hover:text-primary transition-colors disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `${cooldown} 秒後可重寄` : '重寄驗證碼'}
          </button>
          <button
            type="button"
            onClick={handleChangeEmail}
            className="text-gray-500 hover:text-primary transition-colors"
          >
            換一個信箱
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">信件裡的登入連結也可以直接點</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-1">{heading}</h2>
      <p className="text-sm text-gray-500 mb-5">{description}</p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isBusy}
        className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
          <path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.5-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        使用 Google 登入
      </button>

      <div className="flex items-center gap-3 my-4 text-xs text-gray-400">
        <span className="flex-1 h-px bg-gray-200" />
        或
        <span className="flex-1 h-px bg-gray-200" />
      </div>

      <form onSubmit={handleSendCode}>
        <label htmlFor={emailId} className="sr-only">Email</label>
        <input
          id={emailId}
          className={`${inputClass} mb-3`}
          type="email"
          placeholder="your@email.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {errorMessage && (
          <div role="alert" className="mb-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
            {errorMessage}
          </div>
        )}
        <button className={primaryButtonClass} type="submit" disabled={isBusy}>
          {isBusy ? '傳送中...' : '寄送驗證碼'}
        </button>
      </form>
      <p className="text-xs text-gray-400 text-center mt-4">無須密碼，驗證碼 1 小時內有效</p>
    </div>
  );
}
