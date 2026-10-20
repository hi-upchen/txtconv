import { after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getEcpayConfig, isEcpayProduction } from '@/lib/payment/config';
import { listPaidOrders } from '@/lib/payment/orders';
import { errorText } from '@/lib/health/redact';
import type { CheckResult } from '@/lib/health/checks';

const PRODUCTION_URL = 'https://txtconv.arpuli.com';
const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
// PostgREST returns at most this many rows by default.
const ROW_CAP = 1000;

function logFailure(err: unknown): void {
  console.error('payment failure record failed:', errorText(err));
}

// Inserts one failure row. It never throws.
async function writeFailure(row: { reason: string; merchant_trade_no: string | null }): Promise<void> {
  try {
    const { error } = await createServiceClient().from('ecpay_callback_failures').insert(row);
    if (error) logFailure(error.message);
  } catch (err) {
    logFailure(err);
  }
}

// Saves a failed ECPay callback so the health page can report it.
// The write runs after the response, so ECPay gets its answer at once.
// It never throws. A broken record must not change the answer ECPay gets.
//
// Only the production store records anything. Preview and local runs use the
// public test-store keys and share the production database. A forged or test
// callback there must not turn the production monitor red.
export function recordPaymentFailure(reason: string, merchantTradeNo?: string): void {
  if (!isEcpayProduction()) return;
  const row = { reason, merchant_trade_no: merchantTradeNo || null };
  try {
    after(() => writeFailure(row));
  } catch (err) {
    logFailure(err);
  }
}

// Checks the live payment settings. Only Vercel production is checked.
// It needs the ECPay secrets and the real site address.
// Other environments use the ECPay sandbox, so they always pass.
export async function checkPaymentConfig(): Promise<CheckResult> {
  if (process.env.VERCEL_ENV !== 'production') return { status: 'pass' };
  getEcpayConfig();
  if (process.env.NEXT_PUBLIC_APP_URL !== PRODUCTION_URL) {
    return { status: 'fail', output: `NEXT_PUBLIC_APP_URL 不是 ${PRODUCTION_URL}` };
  }
  return { status: 'pass' };
}

// Throws when a list reached the row cap.
// Such a list may be cut short, so the check asks for SQL instead.
function belowRowCap<T>(rows: T[]): T[] {
  if (rows.length >= ROW_CAP) throw new Error('資料超過 1000 筆，請改用 SQL 對帳查詢');
  return rows;
}

// Loads the ids of every profile with the lifetime license. Throws on a database error.
async function loadLifetimeIds(): Promise<string[]> {
  const { data, error } = await createServiceClient()
    .from('profiles')
    .select('id')
    .eq('license_type', 'lifetime');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((p) => p.id);
}

// Finds paid orders whose buyer does not have the lifetime license.
// A buyer with no profile row counts as not licensed.
export async function checkPaidOrders(): Promise<CheckResult> {
  const orders = belowRowCap(await listPaidOrders());
  if (orders.length === 0) return { status: 'pass' };
  const licensed = new Set(belowRowCap(await loadLifetimeIds()));
  const missing = orders.filter((o) => !licensed.has(o.user_id)).map((o) => o.merchant_trade_no);
  if (missing.length === 0) return { status: 'pass' };
  return { status: 'fail', output: `${missing.length} 筆已付款但未開通：${missing.join('、')}` };
}

// Finds users with more than one paid order.
// The output lists every order number of each affected user.
export async function checkDoublePaid(): Promise<CheckResult> {
  const orders = belowRowCap(await listPaidOrders());
  const byUser = new Map<string, string[]>();
  for (const o of orders) {
    const nos = byUser.get(o.user_id);
    if (nos) nos.push(o.merchant_trade_no);
    else byUser.set(o.user_id, [o.merchant_trade_no]);
  }
  const doubled = [...byUser.values()].filter((nos) => nos.length > 1);
  if (doubled.length === 0) return { status: 'pass' };
  return { status: 'fail', output: `${doubled.length} 位使用者重複付款：${doubled.flat().join('、')}` };
}

// Looks for a failed ECPay callback in the last 24 hours.
// A failure that is exactly 24 hours old does not count.
// The check then passes again without any manual reset.
export async function checkCallbackFailures(): Promise<CheckResult> {
  const { data, error } = await createServiceClient()
    .from('ecpay_callback_failures')
    .select('reason, merchant_trade_no, created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const latest = data?.[0];
  if (!latest || Date.now() - new Date(latest.created_at).getTime() >= FAILURE_WINDOW_MS) {
    return { status: 'pass' };
  }
  return { status: 'fail', output: `${latest.reason}，訂單 ${latest.merchant_trade_no ?? '不明'}` };
}
