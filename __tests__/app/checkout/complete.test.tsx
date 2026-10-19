// __tests__/app/checkout/complete.test.tsx
import { render, screen } from '@testing-library/react';

const mockGetAuthUser = jest.fn();
const mockGetProfile = jest.fn();
const mockFindOrderForUser = jest.fn();

jest.mock('@/lib/actions/auth', () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));
jest.mock('@/lib/payment/orders', () => ({
  findOrderForUser: (...args: unknown[]) => mockFindOrderForUser(...args),
}));
jest.mock('@/components/Header', () => ({ __esModule: true, default: () => <header /> }));
jest.mock('@/components/Footer', () => ({ __esModule: true, default: () => <footer /> }));
jest.mock('@/components/LoginPanel', () => ({
  __esModule: true,
  default: (props: { returnTo?: string }) => <div data-testid="login-panel" data-return-to={props.returnTo} />,
}));
jest.mock('@/components/PurchaseTracker', () => ({
  __esModule: true,
  default: (props: { status: string; merchantTradeNo: string; amountTwd: number }) => (
    <div data-testid="tracker" data-status={props.status} data-order={props.merchantTradeNo} data-amount={props.amountTwd} />
  ),
}));

import CheckoutCompletePage from '@/app/checkout/complete/page';

const USER = { id: '22222222-2222-2222-2222-222222222222', email: 'buyer@example.com' };
const ORDER_NO = 'TCabc123def456ghi789';
const PAID_ORDER = { merchant_trade_no: ORDER_NO, user_id: USER.id, amount_twd: 899, status: 'paid' };
const LIFETIME_PROFILE = { id: USER.id, license_type: 'lifetime', license_expires_at: null };

function pageWith(query: Record<string, string>) {
  return CheckoutCompletePage({ searchParams: Promise.resolve(query) });
}

describe('/checkout/complete page', () => {
  beforeEach(() => {
    mockGetAuthUser.mockReset().mockResolvedValue(USER);
    mockGetProfile.mockReset().mockResolvedValue({ id: USER.id, license_type: 'free' });
    mockFindOrderForUser.mockReset();
  });

  it('shows the friendly error when ECPay sent us back with error=1', async () => {
    render(await pageWith({ error: '1' }));
    expect(screen.getByRole('heading', { name: '付款結果無法確認' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '回到結帳頁' })).toHaveAttribute('href', '/checkout');
    expect(mockFindOrderForUser).not.toHaveBeenCalled();
  });

  it('shows the friendly error when the order parameter is missing or malformed', async () => {
    render(await pageWith({}));
    expect(screen.getByRole('heading', { name: '付款結果無法確認' })).toBeInTheDocument();
    render(await pageWith({ order: 'not-an-order' }));
    expect(screen.getAllByRole('heading', { name: '付款結果無法確認' })).toHaveLength(2);
    expect(mockFindOrderForUser).not.toHaveBeenCalled();
  });

  it('asks a guest to log in and brings them back to this exact order', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    render(await pageWith({ order: ORDER_NO }));
    expect(screen.getByTestId('login-panel')).toHaveAttribute(
      'data-return-to',
      `/checkout/complete?order=${ORDER_NO}`,
    );
    expect(mockFindOrderForUser).not.toHaveBeenCalled();
  });

  it('keeps the failed flag in the login return path', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    render(await pageWith({ order: ORDER_NO, failed: '1' }));
    expect(screen.getByTestId('login-panel')).toHaveAttribute(
      'data-return-to',
      `/checkout/complete?order=${ORDER_NO}&failed=1`,
    );
  });

  it('shows "not found" when the order does not belong to the logged-in user', async () => {
    mockFindOrderForUser.mockResolvedValue(null);
    render(await pageWith({ order: ORDER_NO }));
    expect(mockFindOrderForUser).toHaveBeenCalledWith(ORDER_NO, USER.id);
    expect(screen.getByRole('heading', { name: '找不到這筆訂單' })).toBeInTheDocument();
  });

  it('shows "activation in progress" when the order is paid but the licence is not active yet', async () => {
    mockFindOrderForUser.mockResolvedValue(PAID_ORDER);
    mockGetProfile.mockResolvedValue({ id: USER.id, license_type: 'free' });
    render(await pageWith({ order: ORDER_NO }));
    expect(screen.getByRole('heading', { name: '付款完成，開通處理中' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '付款成功，Pro 終身版已開通' })).toBeNull();
    expect(screen.getByText(ORDER_NO)).toBeInTheDocument();
    // The tracker reports the purchase and keeps polling until the licence shows.
    const tracker = screen.getByTestId('tracker');
    expect(tracker).toHaveAttribute('data-status', 'activating');
    expect(tracker).toHaveAttribute('data-amount', '899');
  });

  it('shows "activation in progress" when a paid order has no profile row yet', async () => {
    mockFindOrderForUser.mockResolvedValue(PAID_ORDER);
    mockGetProfile.mockResolvedValue(null);
    render(await pageWith({ order: ORDER_NO }));
    expect(screen.getByRole('heading', { name: '付款完成，開通處理中' })).toBeInTheDocument();
  });

  it('shows a refunded order as refunded, with no purchase event and a link to /checkout', async () => {
    mockFindOrderForUser.mockResolvedValue({ ...PAID_ORDER, status: 'refunded' });
    render(await pageWith({ order: ORDER_NO }));
    expect(screen.getByRole('heading', { name: '此訂單已退款' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '回到結帳頁' })).toHaveAttribute('href', '/checkout');
    expect(screen.queryByTestId('tracker')).toBeNull();
    expect(screen.queryByRole('heading', { name: '付款確認中' })).toBeNull();
  });

  it('shows a refunded order as refunded even when the URL says failed', async () => {
    mockFindOrderForUser.mockResolvedValue({ ...PAID_ORDER, status: 'refunded' });
    render(await pageWith({ order: ORDER_NO, failed: '1' }));
    expect(screen.getByRole('heading', { name: '此訂單已退款' })).toBeInTheDocument();
    expect(screen.queryByTestId('tracker')).toBeNull();
  });

  it('shows success and mounts the tracker in paid mode', async () => {
    mockFindOrderForUser.mockResolvedValue(PAID_ORDER);
    mockGetProfile.mockResolvedValue(LIFETIME_PROFILE);
    render(await pageWith({ order: ORDER_NO }));
    expect(screen.getByRole('heading', { name: '付款成功，Pro 終身版已開通' })).toBeInTheDocument();
    expect(screen.getByText(ORDER_NO)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '回到首頁開始轉換' })).toHaveAttribute('href', '/');
    const tracker = screen.getByTestId('tracker');
    expect(tracker).toHaveAttribute('data-status', 'paid');
    expect(tracker).toHaveAttribute('data-order', ORDER_NO);
    expect(tracker).toHaveAttribute('data-amount', '899');
  });

  it('shows success for a paid order even when the URL says failed', async () => {
    mockFindOrderForUser.mockResolvedValue(PAID_ORDER);
    mockGetProfile.mockResolvedValue(LIFETIME_PROFILE);
    render(await pageWith({ order: ORDER_NO, failed: '1' }));
    expect(screen.getByRole('heading', { name: '付款成功，Pro 終身版已開通' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '付款未完成' })).toBeNull();
  });

  it('shows "confirming", mounts the tracker in pending mode, and offers a way back to pay', async () => {
    mockFindOrderForUser.mockResolvedValue({ ...PAID_ORDER, status: 'pending' });
    render(await pageWith({ order: ORDER_NO }));
    expect(screen.getByRole('heading', { name: '付款確認中' })).toBeInTheDocument();
    expect(screen.getByTestId('tracker')).toHaveAttribute('data-status', 'pending');
    // A buyer who pressed the cashier's back-to-shop button has not paid yet.
    expect(screen.getByRole('link', { name: '還沒付款？回到結帳頁' })).toHaveAttribute('href', '/checkout');
  });

  it('shows "not completed" with a retry link when ECPay reported a failure', async () => {
    mockFindOrderForUser.mockResolvedValue({ ...PAID_ORDER, status: 'pending' });
    render(await pageWith({ order: ORDER_NO, failed: '1' }));
    expect(screen.getByRole('heading', { name: '付款未完成' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '回到結帳頁重新付款' })).toHaveAttribute('href', '/checkout');
    // No polling: the callback will not turn a declined card into a payment.
    expect(screen.queryByTestId('tracker')).toBeNull();
  });
});
