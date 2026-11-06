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

  it('explains the rejection with the real free and Pro limits', () => {
    renderOpen();
    expect(screen.getByRole('heading', { name: '檔案超過免費版 5MB 上限' })).toBeInTheDocument();
    expect(screen.getByText(/大小為 9\.00MB，超過免費版的 5MB 上限，所以沒有轉換/)).toBeInTheDocument();
    expect(screen.getByText(/Pro 終身版可轉換最大 100MB 的檔案/)).toBeInTheDocument();
  });

  it('says before the click that checkout needs a login', () => {
    renderOpen();
    expect(screen.getByText(/購買會綁定你登入的 email。若尚未登入，下一步會先請你登入/)).toBeInTheDocument();
  });
  describe('paywall events', () => {
    const count = (name: string) => window.dataLayer.filter((e) => e.event === name).length;

    it('reports one paywall_shown on open, not on re-render', () => {
      const { rerender } = renderOpen();
      expect(count('paywall_shown')).toBe(1);
      expect(window.dataLayer.find((e) => e.event === 'paywall_shown')).toMatchObject({
        source_path: '/novel',
      });
      rerender(<PaywallDialog open onClose={() => {}} fileName="novel.txt" fileSizeMB="9.00" />);
      expect(count('paywall_shown')).toBe(1);
    });

    it('reports nothing while closed', () => {
      renderOpen({ open: false });
      expect(count('paywall_shown')).toBe(0);
    });

    it('reports paywall_dismissed once for the close button', async () => {
      const onClose = jest.fn();
      renderOpen({ onClose });
      await userEvent.setup().click(screen.getByRole('button', { name: '關閉' }));
      expect(count('paywall_dismissed')).toBe(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('reports paywall_dismissed once for Escape', async () => {
      renderOpen();
      await userEvent.setup().keyboard('{Escape}');
      expect(count('paywall_dismissed')).toBe(1);
    });

    it('reports paywall_dismissed once for a backdrop click', async () => {
      const { container } = renderOpen();
      await userEvent.setup().click(container.firstElementChild as Element);
      expect(count('paywall_dismissed')).toBe(1);
    });

    it('reports paywall_dismissed once for the later link', async () => {
      renderOpen();
      await userEvent.setup().click(screen.getByRole('button', { name: '稍後再說' }));
      expect(count('paywall_dismissed')).toBe(1);
    });

    it('does not report a dismissal for a click inside the panel', async () => {
      renderOpen();
      await userEvent.setup().click(screen.getByRole('dialog'));
      expect(count('paywall_dismissed')).toBe(0);
    });

    it('does not report a dismissal for the buy or pricing links', async () => {
      const user = userEvent.setup();
      renderOpen();
      await user.click(screen.getByRole('link', { name: /升級 Pro 終身版/ }));
      await user.click(screen.getByRole('link', { name: '查看完整方案比較' }));
      expect(count('paywall_dismissed')).toBe(0);
    });
  });
});
