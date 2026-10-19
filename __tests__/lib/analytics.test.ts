import { trackBeginCheckout, trackPurchase } from '@/lib/analytics';

describe('analytics checkout events', () => {
  beforeEach(() => {
    window.dataLayer = [];
    window.history.replaceState({}, '', '/srt');
  });

  it('begin_checkout reports the price in New Taiwan Dollars', () => {
    trackBeginCheckout(899, 'lifetime');
    // The second entry is the reset pushEvent adds after every event.
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer[0]).toEqual({
      event: 'begin_checkout',
      currency: 'TWD',
      value: 899,
      item_name: 'lifetime',
      source_path: '/srt',
    });
  });

  it('purchase carries transaction_id, value, currency and a one-line items array', () => {
    trackPurchase({ transactionId: 'TCabc123def456ghi789', value: 899, currency: 'TWD' });
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer[0]).toEqual({
      event: 'purchase',
      transaction_id: 'TCabc123def456ghi789',
      value: 899,
      currency: 'TWD',
      items: [{ item_name: 'lifetime', price: 899, quantity: 1 }],
    });
  });

  it('clears the purchase keys so later events do not inherit them', () => {
    trackPurchase({ transactionId: 'TCabc123def456ghi789', value: 899, currency: 'TWD' });
    const reset = window.dataLayer[1];
    expect(reset).not.toHaveProperty('event');
    expect(reset).toHaveProperty('transaction_id', undefined);
    expect(reset).toHaveProperty('items', undefined);
    expect(reset).toHaveProperty('value', undefined);
  });
});
