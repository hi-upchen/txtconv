import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthButton from '@/components/AuthButton';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithOAuth: jest.fn(),
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

describe('AuthButton', () => {
  it('shows login button when not authenticated', async () => {
    render(<AuthButton user={null} profile={null} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('opens a dialog with the Google button and the email field', async () => {
    const user = userEvent.setup();
    render(<AuthButton user={null} profile={null} />);

    await user.click(screen.getByRole('button', { name: 'Login' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: '使用 Google 登入' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '寄送驗證碼' })).toBeInTheDocument();
  });

  it('closes the dialog from the close button', async () => {
    const user = userEvent.setup();
    render(<AuthButton user={null} profile={null} />);

    await user.click(screen.getByRole('button', { name: 'Login' }));
    await user.click(screen.getByRole('button', { name: '關閉' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows user email when authenticated', async () => {
    const user = { email: 'test@example.com' };
    render(<AuthButton user={user as any} profile={null} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});
