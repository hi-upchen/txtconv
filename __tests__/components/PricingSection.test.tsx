import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PricingSection from '@/components/PricingSection';

describe('PricingSection', () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.history.replaceState({}, '', '/');
  });

  it('shows only the Free and Lifetime cards', () => {
    render(<PricingSection />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Lifetime')).toBeInTheDocument();
    expect(screen.queryByText('Monthly')).toBeNull();
    expect(screen.queryByText(/即將推出/)).toBeNull();
    expect(screen.queryByText(/Monthly 方案所有功能/)).toBeNull();
  });

  it('prices Lifetime at NT$899 with concrete benefits', () => {
    render(<PricingSection />);
    expect(screen.getByText('NT$899')).toBeInTheDocument();
    expect(screen.queryByText('$30')).toBeNull();
    expect(screen.getByText('單檔最大 100MB（免費版 5MB）')).toBeInTheDocument();
    // Free users can batch convert too, so batch conversion is not a paid benefit.
    expect(screen.queryByText(/批次轉換/)).toBeNull();
    expect(screen.getByText('自訂字典對照 10,000 組')).toBeInTheDocument();
  });

  it('links the buy button to /checkout in the same tab', () => {
    render(<PricingSection />);
    const buy = screen.getByRole('link', { name: /立即購買/ });
    expect(buy).toHaveAttribute('href', '/checkout');
    expect(buy).not.toHaveAttribute('target');
  });

  it('marks Lifetime as the current plan for lifetime users and hides the buy button', () => {
    render(<PricingSection licenseType="lifetime" />);
    expect(screen.queryByRole('link', { name: /立即購買/ })).toBeNull();
    expect(screen.getByRole('button', { name: '目前方案' })).toBeDisabled();
  });

  it('reports begin_checkout at NT$899 on click', async () => {
    const user = userEvent.setup();
    render(<PricingSection />);
    await user.click(screen.getByRole('link', { name: /立即購買/ }));
    const events = window.dataLayer.filter((e) => e.event === 'begin_checkout');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ currency: 'TWD', value: 899, item_name: 'lifetime', source_path: '/' });
  });
});
