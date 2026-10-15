'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import GoogleSignInButton from './GoogleSignInButton';
import {
  LOGIN_RETURN_TO_COOKIE,
  LOGIN_RETURN_TO_MAX_AGE_SECONDS,
  sanitizeReturnTo,
} from '@/lib/auth/return-to';
import { writeCookie } from '@/lib/auth/browser-cookies';
import { assignLocation } from '@/lib/auth/navigation';
import { trackLoginStarted, trackLoginFailed } from '@/lib/analytics';

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
 * Login panel with two ways in: Google's own button, or a six-digit code by email.
 * Used inside LoginDialog and on the expired-link error page.
 *
 * Before either path starts it stores the return path in a cookie.
 * Both paths check the login in the browser, then load /auth/finish.
 * That server route links the profile and redirects back.
 * Email links land on /auth/callback or /auth/confirm instead.
 */
export default function LoginPanel({
  returnTo,
  heading = '登入 / 註冊',
  description,
}: LoginPanelProps) {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
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

  const handleGoogleStart = () => {
    setErrorMessage('');
    rememberReturnTo();
    trackLoginStarted('google', window.location.pathname);
  };

  const handleGoogleCredential = async (idToken: string, rawNonce: string) => {
    setIsGoogleSigningIn(true);
    setErrorMessage('');

    let errorCode: string | null = null;
    try {
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce: rawNonce,
      });
      if (error) errorCode = error.code ?? 'id_token_error';
    } catch {
      errorCode = 'id_token_exception';
    }

    if (errorCode) {
      trackLoginFailed('google', errorCode);
      setErrorMessage('Google 登入失敗，請改用下方 Email 驗證碼登入。');
      setIsGoogleSigningIn(false);
      return;
    }

    // /auth/finish links the profile and reports login_succeeded on the next page.
    // Google can return a token without a click on our button.
    // Saving the return page again covers that case.
    rememberReturnTo();
    assignLocation('/auth/finish?method=google');
  };

  /** Sends a code to the entered email. isResend skips the login_started event. */
  const sendCode = async (isResend: boolean) => {
    setIsBusy(true);
    setErrorMessage('');
    rememberReturnTo();
    if (!isResend) trackLoginStarted('email_code', window.location.pathname);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appBaseUrl()}/auth/callback` },
    });

    if (error) {
      setErrorMessage(
        error.code === 'over_email_send_rate_limit'
          ? '寄送太頻繁，請一分鐘後再試。'
          : '驗證碼寄送失敗，請稍後再試。'
      );
    } else {
      setCode('');
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
    setIsBusy(false);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode(false);
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    await sendCode(true);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setErrorMessage('');

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });

    if (error) {
      trackLoginFailed('email_code', error.code ?? 'otp_verify_error');
      setErrorMessage('驗證碼錯誤或已過期，請重新輸入或重寄驗證碼。');
      setIsBusy(false);
      return;
    }

    // /auth/finish links the profile, clears the return cookie and
    // reports login_succeeded on the next page. Refresh the return cookie
    // first, because the code can outlive the cookie's ten minutes.
    rememberReturnTo();
    assignLocation('/auth/finish');
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

  const errorAlert = errorMessage && (
    <div role="alert" className="mb-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
      {errorMessage}
    </div>
  );

  if (step === 'code') {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">輸入驗證碼</h2>
        <p className="text-sm text-gray-500 mb-5">
          我們已將 6 位數驗證碼寄至<br />
          <span className="font-medium text-gray-700">{email}</span>
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
          {errorAlert}
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
      <p className="text-sm text-gray-500 mb-5">
        {description ??
          (isGoogleAvailable
            ? '使用 Google 帳號一鍵登入，或以 Email 收取驗證碼'
            : '以 Email 收取 6 位數驗證碼登入，無須密碼')}
      </p>

      {isGoogleAvailable && (
        <>
          <GoogleSignInButton
            onStart={handleGoogleStart}
            onCredential={handleGoogleCredential}
            onUnavailable={() => setIsGoogleAvailable(false)}
          />
          {isGoogleSigningIn && (
            <p className="text-sm text-gray-500 text-center mt-2" role="status">Google 登入中…</p>
          )}

          <div className="flex items-center gap-3 my-4 text-xs text-gray-400">
            <span className="flex-1 h-px bg-gray-200" />
            或
            <span className="flex-1 h-px bg-gray-200" />
          </div>
        </>
      )}

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
        {errorAlert}
        <button className={primaryButtonClass} type="submit" disabled={isBusy}>
          {isBusy ? '傳送中...' : '寄送驗證碼'}
        </button>
      </form>
      <p className="text-xs text-gray-400 text-center mt-4">無須密碼，驗證碼 1 小時內有效</p>
    </div>
  );
}
