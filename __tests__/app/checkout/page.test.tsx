// __tests__/app/checkout/page.test.tsx
import { render, screen } from '@testing-library/react';

const mockGetAuthUser = jest.fn();
const mockGetProfile = jest.fn();
const mockEnsureProfileLinked = jest.fn();

jest.mock('@/lib/actions/auth', () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  ensureProfileLinked: (...args: unknown[]) => mockEnsureProfileLinked(...args),
}));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
// Header pulls in the Supabase browser client. LoginPanel pulls in Google's script.
// Both are stubbed, so this test only checks the checkout page's own logic.
jest.mock('@/components/Header', () => ({ __esModule: true, default: () => <header data-testid="header" /> }));
jest.mock('@/components/Footer', () => ({ __esModule: true, default: () => <footer data-testid="footer" /> }));
jest.mock('@/components/LoginPanel', () => ({
  __esModule: true,
  default: (props: { returnTo?: string; heading?: string; description?: string }) => (
    <div data-testid="login-panel" data-return-to={props.returnTo}>
      {props.heading}
    </div>
  ),
}));

import CheckoutPage from '@/app/checkout/page';

const USER = { id: '22222222-2222-2222-2222-222222222222', email: 'buyer@example.com' };
const FREE_PROFILE = { id: USER.id, email: USER.email, license_type: 'free', license_expires_at: null };

describe('/checkout page', () => {
  beforeEach(() => {
    mockGetAuthUser.mockReset();
    mockGetProfile.mockReset();
    mockEnsureProfileLinked.mockReset().mockResolvedValue(undefined);
  });

  it('asks guests to log in and returns them to /checkout afterwards', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    render(await CheckoutPage());

    expect(screen.getByRole('heading', { name: '購買 Pro 終身版' })).toBeInTheDocument();
    expect(screen.getByText('購買會綁定你的 email，請先登入')).toBeInTheDocument();
    expect(screen.getByTestId('login-panel')).toHaveAttribute('data-return-to', '/checkout');
    expect(document.querySelector('form[action="/api/payment/ecpay/create"]')).toBeNull();
  });

  it('shows the NT$899 summary, the bound email, the refund line and the pay form for a free user', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue(FREE_PROFILE);

    render(await CheckoutPage());

    expect(screen.getByText('NT$899')).toBeInTheDocument();
    expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
    expect(screen.getByText('購買後 14 天內不滿意可退款')).toBeInTheDocument();
    expect(screen.getByText('單檔最大 100MB（免費版 5MB）')).toBeInTheDocument();
    expect(screen.queryByText(/批次轉換/)).toBeNull();
    const form = document.querySelector('form[action="/api/payment/ecpay/create"]');
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute('method', 'post');
    expect(screen.getByRole('button', { name: '前往綠界付款' })).toBeInTheDocument();
    expect(screen.queryByTestId('login-panel')).toBeNull();
    expect(mockEnsureProfileLinked).not.toHaveBeenCalled();
  });

  it('creates or links the profile when a logged-in user has none yet', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValueOnce(null).mockResolvedValueOnce(FREE_PROFILE);

    render(await CheckoutPage());

    expect(mockEnsureProfileLinked).toHaveBeenCalledWith(USER.id, USER.email);
    expect(screen.getByText('NT$899')).toBeInTheDocument();
  });

  it('redirects lifetime users to the homepage', async () => {
    mockGetAuthUser.mockResolvedValue(USER);
    mockGetProfile.mockResolvedValue({ ...FREE_PROFILE, license_type: 'lifetime' });

    await expect(CheckoutPage()).rejects.toThrow('NEXT_REDIRECT:/');
  });
});
