/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost/novel?x=1"}
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPanel from '@/components/LoginPanel';
import { assignLocation } from '@/lib/auth/navigation';
import { readCookie } from '@/lib/auth/browser-cookies';

const mockSignInWithOAuth = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
    },
  }),
}));

jest.mock('@/lib/auth/navigation', () => ({
  assignLocation: jest.fn(),
}));

function events(name: string) {
  return window.dataLayer.filter((e) => e.event === name);
}

/** Sends a code to the given address so the panel is on the code step. */
async function reachCodeStep(user: ReturnType<typeof userEvent.setup>, email = 'me@example.com') {
  mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: '寄送驗證碼' }));
  await screen.findByLabelText('驗證碼');
}

describe('LoginPanel', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    window.dataLayer = [];
    document.cookie = 'login_return_to=; Max-Age=0; Path=/';
    document.cookie = 'login_method_hint=; Max-Age=0; Path=/';
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('renders the Google button, the email form and the default copy', () => {
    render(<LoginPanel />);
    expect(screen.getByRole('heading', { name: '登入 / 註冊' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '使用 Google 登入' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '寄送驗證碼' })).toBeInTheDocument();
  });

  it('renders custom heading and description', () => {
    render(<LoginPanel heading="請先登入" description="購買會綁定你的 email" />);
    expect(screen.getByRole('heading', { name: '請先登入' })).toBeInTheDocument();
    expect(screen.getByText('購買會綁定你的 email')).toBeInTheDocument();
  });

  describe('Google path', () => {
    it('remembers the current page, reports login_started and calls signInWithOAuth', async () => {
      const user = userEvent.setup();
      mockSignInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://x' }, error: null });
      render(<LoginPanel />);

      await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

      expect(readCookie('login_return_to')).toBe('/novel?x=1');
      expect(events('login_started')).toEqual([
        { event: 'login_started', method: 'google', source_path: '/novel' },
      ]);
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: 'http://localhost/auth/callback' },
      });
      expect(events('login_failed')).toHaveLength(0);
    });

    it('uses NEXT_PUBLIC_APP_URL as the redirect base when set', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://txtconv.arpuli.com';
      const user = userEvent.setup();
      mockSignInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://x' }, error: null });
      render(<LoginPanel />);

      await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: 'https://txtconv.arpuli.com/auth/callback' },
      });
    });

    it('uses the returnTo prop instead of the current page', async () => {
      const user = userEvent.setup();
      mockSignInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://x' }, error: null });
      render(<LoginPanel returnTo="/checkout" />);

      await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

      expect(readCookie('login_return_to')).toBe('/checkout');
    });

    it('shows a readable error and reports login_failed when Google refuses', async () => {
      const user = userEvent.setup();
      mockSignInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: null },
        error: { message: 'Unsupported provider', code: 'validation_failed' },
      });
      render(<LoginPanel />);

      await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Google 登入失敗，請改用下方 Email 驗證碼登入。');
      expect(events('login_failed')).toEqual([
        { event: 'login_failed', method: 'google', reason: 'validation_failed' },
      ]);
      // The email path stays available as the fallback
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('marks the login method hint before calling signInWithOAuth', async () => {
      const user = userEvent.setup();
      mockSignInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://x' }, error: null });
      render(<LoginPanel />);

      await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

      expect(document.cookie).toContain('login_method_hint=google');
    });
  });

  describe('email code path', () => {
    it('sends the code, reports login_started and switches to the code step', async () => {
      const user = userEvent.setup();
      render(<LoginPanel />);

      await reachCodeStep(user, 'me@example.com');

      expect(readCookie('login_return_to')).toBe('/novel?x=1');
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'me@example.com',
        options: { emailRedirectTo: 'http://localhost/auth/callback' },
      });
      expect(events('login_started')).toEqual([
        { event: 'login_started', method: 'email_code', source_path: '/novel' },
      ]);
      expect(screen.getByText('me@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '確認' })).toBeInTheDocument();
    });

    it('clears a leftover Google hint before sending a code', async () => {
      document.cookie = 'login_method_hint=google; Path=/';
      const user = userEvent.setup();
      render(<LoginPanel />);

      await user.type(screen.getByLabelText('Email'), 'me@example.com');
      await user.click(screen.getByRole('button', { name: '寄送驗證碼' }));

      expect(document.cookie).not.toContain('login_method_hint=google');
    });

    it('shows a rate-limit message when Supabase refuses to send', async () => {
      const user = userEvent.setup();
      mockSignInWithOtp.mockResolvedValue({
        data: {},
        error: { message: 'rate limit', code: 'over_email_send_rate_limit' },
      });
      render(<LoginPanel />);

      await user.type(screen.getByLabelText('Email'), 'me@example.com');
      await user.click(screen.getByRole('button', { name: '寄送驗證碼' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('寄送太頻繁，請一分鐘後再試。');
      expect(screen.queryByLabelText('驗證碼')).not.toBeInTheDocument();
      // Sending failures are not counted as login failures
      expect(events('login_failed')).toHaveLength(0);
    });

    it('locks resend for 60 seconds and then allows it without a second login_started', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<LoginPanel />);
      await reachCodeStep(user);

      const resend = screen.getByRole('button', { name: /重寄/ });
      expect(resend).toBeDisabled();
      expect(resend).toHaveTextContent('60 秒後可重寄');

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(resend).toBeEnabled();
      expect(resend).toHaveTextContent('重寄驗證碼');

      await user.click(resend);

      expect(mockSignInWithOtp).toHaveBeenCalledTimes(2);
      expect(events('login_started')).toHaveLength(1);
      jest.useRealTimers();
    });

    it('verifies the code, reports login_succeeded, clears the cookie and reloads to returnTo', async () => {
      const user = userEvent.setup();
      mockVerifyOtp.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
      render(<LoginPanel returnTo="/checkout" />);
      await reachCodeStep(user);

      await user.type(screen.getByLabelText('驗證碼'), '123456');
      await user.click(screen.getByRole('button', { name: '確認' }));

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'me@example.com',
        token: '123456',
        type: 'email',
      });
      expect(events('login_succeeded')).toEqual([
        { event: 'login_succeeded', method: 'email_code', source_path: '/novel' },
      ]);
      expect(readCookie('login_return_to')).toBeNull();
      expect(assignLocation).toHaveBeenCalledWith('/checkout');
    });

    it('shows the expired-code message and reports login_failed with the Supabase code', async () => {
      const user = userEvent.setup();
      mockVerifyOtp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Token has expired or is invalid', code: 'otp_expired' },
      });
      render(<LoginPanel />);
      await reachCodeStep(user);

      await user.type(screen.getByLabelText('驗證碼'), '000000');
      await user.click(screen.getByRole('button', { name: '確認' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('驗證碼錯誤或已過期，請重新輸入或重寄驗證碼。');
      expect(events('login_failed')).toEqual([
        { event: 'login_failed', method: 'email_code', reason: 'otp_expired' },
      ]);
      expect(assignLocation).not.toHaveBeenCalled();
      // The user can still resend or change the address
      expect(screen.getByRole('button', { name: /重寄/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '換一個信箱' })).toBeInTheDocument();
    });

    it('goes back to the email form when the user wants another address', async () => {
      const user = userEvent.setup();
      render(<LoginPanel />);
      await reachCodeStep(user);

      await user.click(screen.getByRole('button', { name: '換一個信箱' }));

      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.queryByLabelText('驗證碼')).not.toBeInTheDocument();
    });
  });
});
