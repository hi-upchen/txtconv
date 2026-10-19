/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost/auth/auth-code-error"}
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthCodeErrorLogin from '@/components/AuthCodeErrorLogin';
import { readCookie } from '@/lib/auth/browser-cookies';

const mockSignInWithOtp = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithIdToken: jest.fn(),
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: jest.fn(),
    },
  }),
}));
jest.mock('@/components/GoogleSignInButton', () => ({
  __esModule: true,
  // A jest.mock factory cannot use the top-level React import, so it requires React itself.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  default: () => require('react').createElement('div', { 'data-testid': 'google-signin-button' }),
}));
jest.mock('@/lib/auth/navigation', () => ({ assignLocation: jest.fn() }));

/** Pushed events only. Skips the reset entry that clears login keys after each event. */
const pushedEvents = () => window.dataLayer.filter((entry) => entry.event !== undefined);

describe('AuthCodeErrorLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.dataLayer = [];
    document.cookie = 'login_return_to=; Max-Age=0; Path=/';
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it('reports login_failed as magic_link once on mount', () => {
    render(<AuthCodeErrorLogin />);
    expect(pushedEvents()).toEqual([
      { event: 'login_failed', method: 'magic_link', reason: 'link_invalid_or_expired' },
    ]);
  });

  it('shows the login panel with the retry heading', () => {
    render(<AuthCodeErrorLogin />);
    expect(screen.getByRole('heading', { name: '改用驗證碼登入' })).toBeInTheDocument();
    expect(screen.getByTestId('google-signin-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('returns to the page remembered by the earlier attempt, not to this error page', async () => {
    document.cookie = 'login_return_to=%2Fsrt; Path=/';
    const user = userEvent.setup();
    render(<AuthCodeErrorLogin />);

    await user.type(screen.getByLabelText('Email'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: '寄送驗證碼' }));

    expect(readCookie('login_return_to')).toBe('/srt');
  });

  it('falls back to / when nothing was remembered', async () => {
    const user = userEvent.setup();
    render(<AuthCodeErrorLogin />);

    await user.type(screen.getByLabelText('Email'), 'me@example.com');
    await user.click(screen.getByRole('button', { name: '寄送驗證碼' }));

    expect(readCookie('login_return_to')).toBe('/');
  });
});
