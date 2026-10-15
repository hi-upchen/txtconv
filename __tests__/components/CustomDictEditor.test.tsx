import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomDictEditor from '@/components/CustomDictEditor';

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithIdToken: jest.fn(),
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
    },
  }),
}));

jest.mock('@/lib/client-converter', () => ({
  updateDictCache: jest.fn(),
}));

jest.mock('@/components/GoogleSignInButton', () => ({
  __esModule: true,
  // A jest.mock factory cannot use the top-level React import, so it requires React itself.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  default: () => require('react').createElement('div', { 'data-testid': 'google-signin-button' }),
}));

describe('CustomDictEditor (guest)', () => {
  it('opens the shared login panel from the dictionary overlay', async () => {
    const user = userEvent.setup();
    render(<CustomDictEditor user={null} profile={null} />);

    await user.click(screen.getByRole('button', { name: /Login/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '登入 / 註冊' })).toBeInTheDocument();
    expect(screen.getByText('登入後即可建立自訂字典')).toBeInTheDocument();
    expect(screen.getByTestId('google-signin-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '寄送登入連結' })).not.toBeInTheDocument();
  });
});
