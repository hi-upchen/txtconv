/**
 * Reads and writes for the `ecpay_orders` table and the lifetime grant on `profiles`.
 *
 * Every function uses the service-role client. The orders table has row-level
 * security on and no policies. So only this server code can touch it.
 */

import { createServiceClient } from '@/lib/supabase/server';

/** Order states. An unpaid order simply stays pending. There is no failed state. */
export type EcpayOrderStatus = 'pending' | 'paid';

/** One row of `public.ecpay_orders`. Column names match the migration. */
export interface EcpayOrder {
  id: string;
  merchant_trade_no: string;
  user_id: string;
  email: string;
  amount_twd: number;
  status: EcpayOrderStatus;
  ecpay_trade_no: string | null;
  payment_type: string | null;
  payment_date: string | null;
  rtn_code: number | null;
  rtn_msg: string | null;
  simulate_paid: boolean;
  raw_callback: Record<string, string> | null;
  created_at: string;
  paid_at: string | null;
}

/** The parts of a verified ECPay callback we keep on the order. */
export interface PaidCallbackFields {
  ecpayTradeNo: string;
  paymentType: string;
  /** ISO instant from ECPay's PaymentDate, or null when it could not be read. */
  paymentDate: string | null;
  rtnCode: number;
  rtnMsg: string;
  /** The complete callback body, kept for reconciliation. */
  rawCallback: Record<string, string>;
}

/** Outcome of the atomic pending-to-paid update. */
export type MarkOrderPaidResult = 'paid_now' | 'already_paid' | 'not_found';

/**
 * Inserts a pending order for the logged-in buyer.
 *
 * It throws when the insert fails. The create route turns that into an error page.
 */
export async function createPendingOrder(input: {
  userId: string;
  email: string;
  amountTwd: number;
  merchantTradeNo: string;
}): Promise<EcpayOrder> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ecpay_orders')
    .insert({
      merchant_trade_no: input.merchantTradeNo,
      user_id: input.userId,
      email: input.email,
      amount_twd: input.amountTwd,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`ecpay_orders insert failed: ${error?.message ?? 'no row returned'}`);
  }
  return data as EcpayOrder;
}

/** Finds an order by ECPay's MerchantTradeNo. Returns null when absent or on error. */
export async function findOrderByTradeNo(merchantTradeNo: string): Promise<EcpayOrder | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ecpay_orders')
    .select('*')
    .eq('merchant_trade_no', merchantTradeNo)
    .maybeSingle();

  if (error) {
    console.error('ecpay/orders: findOrderByTradeNo failed', { merchantTradeNo, error: error.message });
    return null;
  }
  return (data as EcpayOrder | null) ?? null;
}

/**
 * Marks an order paid in one statement.
 *
 * The `status = 'pending'` condition makes the change atomic.
 * ECPay retries callbacks, so the same order can arrive twice.
 * The second arrival updates zero rows. We then look the order up once more.
 * That tells a duplicate (`already_paid`) apart from an unknown order (`not_found`).
 */
export async function markOrderPaid(
  merchantTradeNo: string,
  fields: PaidCallbackFields,
): Promise<MarkOrderPaidResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ecpay_orders')
    .update({
      status: 'paid',
      ecpay_trade_no: fields.ecpayTradeNo,
      payment_type: fields.paymentType,
      payment_date: fields.paymentDate,
      rtn_code: fields.rtnCode,
      rtn_msg: fields.rtnMsg,
      simulate_paid: false,
      raw_callback: fields.rawCallback,
      paid_at: new Date().toISOString(),
    })
    .eq('merchant_trade_no', merchantTradeNo)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    throw new Error(`ecpay_orders update failed: ${error.message}`);
  }
  if (Array.isArray(data) && data.length > 0) return 'paid_now';

  const existing = await findOrderByTradeNo(merchantTradeNo);
  if (existing?.status === 'paid') return 'already_paid';
  return 'not_found';
}

/**
 * Gives a buyer the lifetime licence.
 *
 * It updates the profile row and leaves the Gumroad columns alone.
 * An update that matches no row does not report an error.
 * So when no row changed, we insert a lifetime profile instead.
 * It returns false on any database error, so the callback asks ECPay to retry.
 */
export async function grantLifetime(
  userId: string,
  email: string,
  purchasedAt: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({
      license_type: 'lifetime',
      license_expires_at: null,
      purchased_at: purchasedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('id');

  if (error) {
    console.error('ecpay/orders: grantLifetime update failed', { userId, error: error.message });
    return false;
  }
  if (Array.isArray(data) && data.length > 0) return true;

  // The buyer has no profile row. Create one so the payment is not lost.
  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    email,
    license_type: 'lifetime',
    purchased_at: purchasedAt,
  });
  if (insertError) {
    console.error('ecpay/orders: grantLifetime insert failed', { userId, error: insertError.message });
    return false;
  }
  return true;
}

/**
 * Finds an order that belongs to the given user.
 *
 * Both columns must match. Someone holding another buyer's order number gets null.
 * So the completion page never shows another buyer's order.
 */
export async function findOrderForUser(
  merchantTradeNo: string,
  userId: string,
): Promise<EcpayOrder | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ecpay_orders')
    .select('*')
    .eq('merchant_trade_no', merchantTradeNo)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('ecpay/orders: findOrderForUser failed', { merchantTradeNo, error: error.message });
    return null;
  }
  return (data as EcpayOrder | null) ?? null;
}

/**
 * Returns another paid order by the same buyer, or null.
 *
 * A buyer can pay twice from two open cashier tabs.
 * The callback uses this to flag the second payment for a manual refund.
 * Errors return null, because this check must never block a grant.
 */
export async function findOtherPaidOrder(
  userId: string,
  merchantTradeNo: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('ecpay_orders')
    .select('merchant_trade_no')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .neq('merchant_trade_no', merchantTradeNo)
    .limit(1);

  if (error) {
    console.error('ecpay/orders: findOtherPaidOrder failed', { userId, error: error.message });
    return null;
  }
  const rows = (data ?? []) as Array<{ merchant_trade_no: string }>;
  return rows.length > 0 ? rows[0].merchant_trade_no : null;
}
