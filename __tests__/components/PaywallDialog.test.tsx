import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaywallDialog from '@/components/PaywallDialog';

describe('PaywallDialog', () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.history.replaceState({}, '', '/novel');
  });

  function renderOpen(props: Partial<React.ComponentProps<typeof PaywallDialog>> = {}) {
    return render(
      <PaywallDialog
        open
        onClose={() => {}}
        fileName="novel.txt"
        fileSizeMB="9.00"
        {...props}
      />,
    );
  }

  it('links the buy button to /checkout in the same tab', () => {
    renderOpen();
    const buy = screen.getByRole('link', { name: /升級 Pro 終身版 NT\$899/ });
    expect(buy).toHaveAttribute('href', '/checkout');
    expect(buy).not.toHaveAttribute('target');
    // Focus still moves to the buy button when the dialog opens.
    expect(buy).toHaveFocus();
  });

  it('shows the NT$899 benefit line and the 14-day refund promise', () => {
    renderOpen();
    expect(screen.getByText(/一次付費 NT\$899，永久使用/)).toBeInTheDocument();
    expect(screen.getByText('購買後 14 天內不滿意可退款')).toBeInTheDocument();
    expect(screen.queryByText(/US\$30/)).toBeNull();
  });

  it('lists the real file size benefit and does not sell batch conversion', () => {
    renderOpen();
    expect(screen.getByText('單檔最大 100MB（免費版 5MB）')).toBeInTheDocument();
    expect(screen.queryByText(/批次轉換/)).toBeNull();
  });

  it('reports begin_checkout at NT$899 when the buy button is clicked', async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole('link', { name: /升級 Pro 終身版 NT\$899/ }));
    const events = window.dataLayer.filter((e) => e.event === 'begin_checkout');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ currency: 'TWD', value: 899, item_name: 'lifetime', source_path: '/novel' });
  });
});
