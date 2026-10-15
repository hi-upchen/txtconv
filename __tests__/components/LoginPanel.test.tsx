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

const mockSignInWithIdToken = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithIdToken: mockSignInWithIdToken,
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
    },
  }),
}));

jest.mock('@/lib/auth/navigation', () => ({
  assignLocation: jest.fn(),
}));

// jest.mock factories may only reference variables whose names start with "mock".
let mockGoogleProps: {
  onStart: () => void;
  onCredential: (idToken: string, rawNonce: string) => void;
  onUnavailable: () => void;
};
jest.mock('@/components/GoogleSignInButton', () => ({
  __esModule: true,
  default: (props: typeof mockGoogleProps) => {
    mockGoogleProps = props;
    // A jest.mock factory cannot use the top-level React import, so it requires React itself.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react').createElement('div', { 'data-testid': 'google-signin-button' });
  },
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
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it('renders the Google button, the email form and the default copy', () => {
    render(<LoginPanel />);
    expect(screen.getByRole('heading', { name: '登入 / 註冊' })).toBeInTheDocument();
    expect(screen.getByTestId('google-signin-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '寄送驗證碼' })).toBeInTheDocument();
  });

  it('renders custom heading and description', () => {
    render(<LoginPanel heading="請先登入" description="購買會綁定你的 email" />);
    expect(screen.getByRole('heading', { name: '請先登入' })).toBeInTheDocument();
    expect(screen.getByText('購買會綁定你的 email')).toBeInTheDocument();
  });

  it('uses email-only copy when Google is unavailable and no description is given', () => {
    render(<LoginPanel />);
    expect(screen.getByText('使用 Google 帳號一鍵登入，或以 Email 收取驗證碼')).toBeInTheDocument();

    act(() => mockGoogleProps.onUnavailable());

    expect(screen.getByText('以 Email 收取 6 位數驗證碼登入，無須密碼')).toBeInTheDocument();
  });

  it('keeps a caller-supplied description when Google is unavailable', () => {
    render(<LoginPanel description="購買會綁定你的 email" />);
    act(() => mockGoogleProps.onUnavailable());
    expect(screen.getByText('購買會綁定你的 email')).toBeInTheDocument();
  });

  describe('Google path', () => {
    it('remembers the current page and reports login_started when the button is clicked', () => {
      render(<LoginPanel />);

      act(() => mockGoogleProps.onStart());

      expect(readCookie('login_return_to')).toBe('/novel?x=1');
      expect(events('login_started')).toEqual([
        { event: 'login_started', method: 'google', source_path: '/novel' },
      ]);
    });

    it('signs in with the ID token and nonce, then loads /auth/finish for Google', async () => {
      mockSignInWithIdToken.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
      render(<LoginPanel returnTo="/checkout" />);

      await act(async () => mockGoogleProps.onCredential('id-token', 'raw-nonce'));

      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'id-token',
        nonce: 'raw-nonce',
      });
      expect(readCookie('login_return_to')).toBe('/checkout');
      expect(assignLocation).toHaveBeenCalledWith('/auth/finish?method=google');
      expect(events('login_failed')).toHaveLength(0);
    });

    it('shows a readable error and reports login_failed when Supabase rejects the token', async () => {
      mockSignInWithIdToken.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Nonces mismatch', code: 'bad_oauth_callback' },
      });
      render(<LoginPanel />);

      await act(async () => mockGoogleProps.onCredential('id-token', 'raw-nonce'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Google 登入失敗，請改用下方 Email 驗證碼登入。');
      expect(events('login_failed')).toEqual([
        { event: 'login_failed', method: 'google', reason: 'bad_oauth_callback' },
      ]);
      expect(assignLocation).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('shows a Google status line while signing in, without relabelling the email button', async () => {
      let finish: (v: unknown) => void = () => {};
      mockSignInWithIdToken.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      render(<LoginPanel />);

      act(() => { void mockGoogleProps.onCredential('id-token', 'raw-nonce'); });

      expect(await screen.findByRole('status')).toHaveTextContent('Google 登入中…');
      expect(screen.getByRole('button', { name: '寄送驗證碼' })).toBeEnabled();
      expect(screen.queryByText('傳送中...')).not.toBeInTheDocument();

      await act(async () => finish({ data: {}, error: { message: 'bad', code: 'x' } }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('treats a thrown sign-in error like a returned one', async () => {
      mockSignInWithIdToken.mockRejectedValue(new Error('network down'));
      render(<LoginPanel />);

      await act(async () => mockGoogleProps.onCredential('id-token', 'raw-nonce'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Google 登入失敗，請改用下方 Email 驗證碼登入。');
      expect(events('login_failed')).toEqual([
        { event: 'login_failed', method: 'google', reason: 'id_token_exception' },
      ]);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '寄送驗證碼' })).toBeEnabled();
      expect(assignLocation).not.toHaveBeenCalled();
    });

    it('hides the Google option and its divider when Google cannot load', () => {
      render(<LoginPanel />);

      act(() => mockGoogleProps.onUnavailable());

      expect(screen.queryByTestId('google-signin-button')).not.toBeInTheDocument();
      expect(screen.queryByText('或')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
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

    it('verifies the code, keeps the return path and loads /auth/finish', async () => {
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
      // The finish route reports login_succeeded after the redirect.
      expect(events('login_succeeded')).toEqual([]);
      expect(readCookie('login_return_to')).toBe('/checkout');
      expect(assignLocation).toHaveBeenCalledWith('/auth/finish');
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
