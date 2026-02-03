export type LicenseType = 'free' | 'lifetime' | 'monthly';

export interface Profile {
  id: string;
  email: string;
  license_type: LicenseType;
  license_expires_at: string | null;
  gumroad_purchase_id: string | null;
  gumroad_product_id: string | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
  custom_dict_url: string | null;
}

export interface GumroadWebhookPayload {
  // Core identifiers
  seller_id: string;
  product_id: string;
  sale_id: string;
  order_number: string;
  purchaser_id: string;

  // Product info
  product_name: string;
  permalink: string;
  product_permalink: string;
  short_product_id: string;

  // Buyer info
  email: string;
  ip_country: string;
  can_contact: boolean;
  referrer: string;

  // Payment info
  price: number;
  gumroad_fee: number;
  currency: string;
  quantity: number;
  variants: string;

  // Card info
  card_visual: string;
  card_type: string;
  card_bin: string;
  card_expiry_month: string;
  card_expiry_year: string;

  // Status flags
  discover_fee_charged: boolean;
  is_gift_receiver_purchase: boolean;
  refunded: boolean;
  disputed: boolean;
  dispute_won: boolean;
  test: boolean;

  // Timestamps
  sale_timestamp: string;
}

export interface GumroadSale extends GumroadWebhookPayload {
  id: string;
  created_at: string;
}
