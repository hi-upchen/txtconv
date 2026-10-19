// __tests__/components/PurchaseTracker.test.tsx
import { act, render, screen } from '@testing-library/react';

const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import PurchaseTracker, { purchaseTrackedKey } from '@/components/PurchaseTracker';

const ORDER_NO = 'TCabc123def456ghi789';

/** Purchase events pushed so far. The resets pushEvent adds carry no event name. */
function purchases() {
  return window.dataLayer.filter((e) => e.event === 'purchase');
}

describe('PurchaseTracker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.dataLayer = [];
    window.sessionStorage.clear();
    mockRefresh.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pushes exactly one purchase event for a paid order and remembers it', () => {
    const { unmount } = render(
      <PurchaseTracker status="paid" merchantTradeNo={ORDER_NO} amountTwd={899} />,
    );

    expect(purchases()).toHaveLength(1);
    expect(purchases()[0]).toMatchObject({
      transaction_id: ORDER_NO,
      value: 899,
      currency: 'TWD',
      items: [{ item_name: 'lifetime', price: 899, quantity: 1 }],
    });
    expect(window.sessionStorage.getItem(purchaseTrackedKey(ORDER_NO))).toBe('1');

    // A remount after a reload or the back button must not count the order again.
    unmount();
    render(<PurchaseTracker status="paid" merchantTradeNo={ORDER_NO} amountTwd={899} />);
    expect(purchases()).toHaveLength(1);
  });

  it('renders nothing visible for a paid order', () => {
    const { container } = render(
      <PurchaseTracker status="paid" merchantTradeNo={ORDER_NO} amountTwd={899} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('refreshes every 3 seconds while pending and never pushes purchase', () => {
    render(<PurchaseTracker status="pending" merchantTradeNo={ORDER_NO} amountTwd={899} />);

    expect(screen.getByText(/每 3 秒會自動更新/)).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(3);
    expect(purchases()).toHaveLength(0);
  });

  it('reports one purchase and stops polling when the callback lands after the browser', () => {
    const { rerender } = render(
      <PurchaseTracker status="pending" merchantTradeNo={ORDER_NO} amountTwd={899} />,
    );
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(2);

    // The server page re-rendered after a refresh and now reads the order as paid.
    rerender(<PurchaseTracker status="paid" merchantTradeNo={ORDER_NO} amountTwd={899} />);
    expect(purchases()).toHaveLength(1);
    expect(screen.queryByText(/每 3 秒會自動更新/)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(9000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(2);
    expect(purchases()).toHaveLength(1);
  });

  it('stops refreshing after 60 seconds and shows the contact notice with the order number', () => {
    render(<PurchaseTracker status="pending" merchantTradeNo={ORDER_NO} amountTwd={899} />);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    const callsAtSixty = mockRefresh.mock.calls.length;
    expect(callsAtSixty).toBeGreaterThanOrEqual(19);
    expect(screen.getByText(/若你已完成扣款/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hi.upchen@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:hi.upchen@gmail.com',
    );
    expect(screen.getByText(new RegExp(ORDER_NO))).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(mockRefresh).toHaveBeenCalledTimes(callsAtSixty);
  });

  it('clears the interval on unmount', () => {
    const { unmount } = render(
      <PurchaseTracker status="pending" merchantTradeNo={ORDER_NO} amountTwd={899} />,
    );
    unmount();
    act(() => {
      jest.advanceTimersByTime(9000);
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
