/**
 * @jest-environment node
 */

import { POST } from '@/app/api/webhooks/gumroad/route';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: '123' }, error: null }),
        }),
      }),
    }),
  }),
}));

describe('Gumroad Webhook', () => {
  const validPayload = {
    seller_id: 'test-seller-id',
    product_id: 'test-product-id',
    email: 'buyer@example.com',
    sale_id: 'sale-123',
    sale_timestamp: '2024-01-01T00:00:00Z',
    price: '49900',
    is_recurring_charge: 'false',
    resource_name: 'sale',
  };

  beforeEach(() => {
    process.env.GUMROAD_SELLER_ID = 'test-seller-id';
    process.env.GUMROAD_LIFETIME_PRODUCT_ID = 'test-product-id';
  });

  it('returns 401 for invalid seller_id', async () => {
    const formData = new FormData();
    Object.entries({ ...validPayload, seller_id: 'wrong-id' }).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const request = new Request('http://localhost/api/webhooks/gumroad', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 200 for valid webhook', async () => {
    const formData = new FormData();
    Object.entries(validPayload).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const request = new Request('http://localhost/api/webhooks/gumroad', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
