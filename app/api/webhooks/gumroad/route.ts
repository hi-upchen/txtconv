import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { GumroadWebhookPayload } from '@/types/user';

/**
 * Gumroad Webhook Handler
 *
 * Sample payload from Gumroad ping:
 * {
 *   "seller_id": "9MNhwBVl3w6hN8muzCv86Q==",
 *   "product_id": "B3K7zHJBfTCgXhEWPJnJcQ==",
 *   "product_name": "捐助支持簡體轉繁體工具",
 *   "permalink": "txtconv",
 *   "product_permalink": "https://upchen.gumroad.com/l/txtconv",
 *   "short_product_id": "ccxux",
 *   "email": "daruitoki@gmail.com",
 *   "price": "1500",
 *   "gumroad_fee": "200",
 *   "currency": "usd",
 *   "quantity": "1",
 *   "discover_fee_charged": "false",
 *   "can_contact": "true",
 *   "referrer": "direct",
 *   "card[visual]": "daruitoki@gmail.com",
 *   "card[type]": "paypal",
 *   "card[bin]": "",
 *   "card[expiry_month]": "",
 *   "card[expiry_year]": "",
 *   "order_number": "627652801",
 *   "sale_id": "43B-ogwCqvDAPQhlCAALJg==",
 *   "sale_timestamp": "2026-01-10T14:15:40Z",
 *   "purchaser_id": "6923323685518",
 *   "variants[]": "15 美金",
 *   "ip_country": "Taiwan",
 *   "is_gift_receiver_purchase": "false",
 *   "refunded": "false",
 *   "disputed": "false",
 *   "dispute_won": "false",
 *   "test": "true"
 * }
 */

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Log full payload for debugging
    console.log('=== GUMROAD WEBHOOK RECEIVED ===');
    const allFields: Record<string, string> = {};
    formData.forEach((value, key) => {
      allFields[key] = value.toString();
    });
    console.log(JSON.stringify(allFields, null, 2));
    console.log('================================');

    function parseBoolean(value: string | null): boolean {
      return value === 'true';
    }

    function parseNumber(value: string | null): number {
      return parseInt(value || '0', 10);
    }

    // Validate required fields
    const seller_id = formData.get('seller_id') as string | null;
    const product_id = formData.get('product_id') as string | null;
    const sale_id = formData.get('sale_id') as string | null;
    const email = formData.get('email') as string | null;

    if (!seller_id || !product_id || !sale_id || !email) {
      console.error('Missing required fields:', { seller_id: !!seller_id, product_id: !!product_id, sale_id: !!sale_id, email: !!email });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payload: GumroadWebhookPayload = {
      // Core identifiers
      seller_id,
      product_id,
      sale_id,
      order_number: formData.get('order_number') as string || '',
      purchaser_id: formData.get('purchaser_id') as string || '',

      // Product info
      product_name: formData.get('product_name') as string || '',
      permalink: formData.get('permalink') as string || '',
      product_permalink: formData.get('product_permalink') as string || '',
      short_product_id: formData.get('short_product_id') as string || '',

      // Buyer info
      email,
      ip_country: formData.get('ip_country') as string || '',
      can_contact: parseBoolean(formData.get('can_contact') as string),
      referrer: formData.get('referrer') as string || '',

      // Payment info
      price: parseNumber(formData.get('price') as string),
      gumroad_fee: parseNumber(formData.get('gumroad_fee') as string),
      currency: formData.get('currency') as string || '',
      quantity: parseNumber(formData.get('quantity') as string),
      variants: formData.get('variants[]') as string || '',

      // Card info
      card_visual: formData.get('card[visual]') as string || '',
      card_type: formData.get('card[type]') as string || '',
      card_bin: formData.get('card[bin]') as string || '',
      card_expiry_month: formData.get('card[expiry_month]') as string || '',
      card_expiry_year: formData.get('card[expiry_year]') as string || '',

      // Status flags
      discover_fee_charged: parseBoolean(formData.get('discover_fee_charged') as string),
      is_gift_receiver_purchase: parseBoolean(formData.get('is_gift_receiver_purchase') as string),
      refunded: parseBoolean(formData.get('refunded') as string),
      disputed: parseBoolean(formData.get('disputed') as string),
      dispute_won: parseBoolean(formData.get('dispute_won') as string),
      test: parseBoolean(formData.get('test') as string),

      // Timestamps
      sale_timestamp: formData.get('sale_timestamp') as string,
    };

    // Verify seller_id matches
    if (payload.seller_id !== process.env.GUMROAD_SELLER_ID) {
      console.error('Invalid seller_id:', payload.seller_id);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if this is the configured Pro product
    const isConfiguredProduct = payload.product_id === process.env.GUMROAD_LIFETIME_PRODUCT_ID;
    if (!isConfiguredProduct) {
      console.log(`Ignoring non-Pro product: ${payload.product_id} (${payload.product_name})`);
      return NextResponse.json({ success: true, ignored: true }, { status: 200 });
    }

    // This is a lifetime Pro purchase
    const licenseType = 'lifetime';

    // Lifetime purchases don't expire
    const expiresAt = null;

    const supabase = createServiceClient();

    // Upsert sale record to gumroad_sales table
    const { error: saleError } = await supabase
      .from('gumroad_sales')
      .upsert(
        {
          seller_id: payload.seller_id,
          product_id: payload.product_id,
          sale_id: payload.sale_id,
          order_number: payload.order_number,
          purchaser_id: payload.purchaser_id,
          product_name: payload.product_name,
          permalink: payload.permalink,
          product_permalink: payload.product_permalink,
          short_product_id: payload.short_product_id,
          email: payload.email,
          ip_country: payload.ip_country,
          can_contact: payload.can_contact,
          referrer: payload.referrer,
          price: payload.price,
          gumroad_fee: payload.gumroad_fee,
          currency: payload.currency,
          quantity: payload.quantity,
          variants: payload.variants,
          card_visual: payload.card_visual,
          card_type: payload.card_type,
          card_bin: payload.card_bin,
          card_expiry_month: payload.card_expiry_month,
          card_expiry_year: payload.card_expiry_year,
          discover_fee_charged: payload.discover_fee_charged,
          is_gift_receiver_purchase: payload.is_gift_receiver_purchase,
          refunded: payload.refunded,
          disputed: payload.disputed,
          dispute_won: payload.dispute_won,
          test: payload.test,
          sale_timestamp: payload.sale_timestamp,
        },
        { onConflict: 'sale_id' }
      );

    if (saleError) {
      console.error('Error upserting sale:', saleError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    console.log(`Sale logged: ${payload.sale_id} for ${payload.email}`);

    // Find existing profile by email or create new one
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', payload.email)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({
          license_type: licenseType,
          license_expires_at: expiresAt,
          gumroad_purchase_id: payload.sale_id,
          gumroad_product_id: payload.product_id,
          purchased_at: payload.sale_timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id);

      if (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    } else {
      // Create profile for non-authenticated user (they'll link when they sign up)
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: payload.email,
          license_type: licenseType,
          license_expires_at: expiresAt,
          gumroad_purchase_id: payload.sale_id,
          gumroad_product_id: payload.product_id,
          purchased_at: payload.sale_timestamp,
        });

      if (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    }

    console.log(`Processed purchase for ${payload.email}: ${licenseType}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
