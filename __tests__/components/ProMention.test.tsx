import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProMention from '@/components/ProMention';
import FileUpload from '@/components/FileUpload';

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

describe('ProMention', () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.history.replaceState({}, '', '/');
  });

  it('links to checkout, shows the refund line and reports the location on click', async () => {
    const user = userEvent.setup();
    render(<ProMention location="dictionary">說明</ProMention>);
    const link = screen.getByRole('link', { name: /了解 Pro 終身版/ });
    expect(link).toHaveAttribute('href', '/checkout');
    expect(screen.getByText(/購買後 14 天內不滿意可退款/)).toBeInTheDocument();
    await user.click(link);
    const events = window.dataLayer.filter((e) => e.event === 'upgrade_cta_clicked');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ cta_source: 'dictionary', location: 'dictionary', source_path: '/' });
  });

  it('shows the batch mention with the shared limits to free users', async () => {
    const user = userEvent.setup();
    render(<FileUpload licenseType="free" />);
    expect(screen.getByTestId('pro-mention-batch')).toHaveTextContent(
      '免費版單檔上限 5MB，Pro 終身版 NT$899 可轉最大 100MB',
    );
    await user.click(screen.getByRole('link', { name: /了解 Pro 終身版/ }));
    expect(window.dataLayer.find((e) => e.event === 'upgrade_cta_clicked')).toMatchObject({
      location: 'batch',
    });
  });

  it('hides the batch mention from Pro users', () => {
    render(<FileUpload licenseType="lifetime" />);
    expect(screen.queryByTestId('pro-mention-batch')).toBeNull();
  });
});
