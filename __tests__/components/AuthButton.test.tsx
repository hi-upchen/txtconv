import { render, screen } from '@testing-library/react';
import AuthButton from '@/components/AuthButton';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithOtp: jest.fn(),
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

  it('shows user email when authenticated', async () => {
    const user = { email: 'test@example.com' };
    render(<AuthButton user={user as any} profile={null} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});
