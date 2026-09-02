/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost/auth/auth-code-error"}
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthCodeErrorLogin from '@/components/AuthCodeErrorLogin';
import { readCookie } from '@/lib/auth/browser-cookies';

const mockSignInWithOAuth = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
    },
  }),
}));
jest.mock('@/lib/auth/navigation', () => ({ assignLocation: jest.fn() }));

describe('AuthCodeErrorLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.dataLayer = [];
    document.cookie = 'login_return_to=; Max-Age=0; Path=/';
    mockSignInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://x' }, error: null });
  });

  it('reports login_failed once on mount', () => {
    render(<AuthCodeErrorLogin />);
    expect(window.dataLayer).toEqual([
      { event: 'login_failed', method: 'magic_link', reason: 'link_invalid_or_expired' },
    ]);
  });

  it('shows the login panel with the retry heading', () => {
    render(<AuthCodeErrorLogin />);
    expect(screen.getByRole('heading', { name: '改用驗證碼登入' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '使用 Google 登入' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('returns to the page remembered by the earlier attempt, not to this error page', async () => {
    document.cookie = 'login_return_to=%2Fsrt; Path=/';
    const user = userEvent.setup();
    render(<AuthCodeErrorLogin />);

    await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

    expect(readCookie('login_return_to')).toBe('/srt');
  });

  it('falls back to / when nothing was remembered', async () => {
    const user = userEvent.setup();
    render(<AuthCodeErrorLogin />);

    await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));

    expect(readCookie('login_return_to')).toBe('/');
  });
});
