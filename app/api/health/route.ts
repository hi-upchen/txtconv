import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  checkAuth,
  checkDatabase,
  checkDictionaryStore,
  type CheckResult,
  type CheckStatus,
} from '@/lib/health/checks';
import {
  checkCallbackFailures,
  checkDoublePaid,
  checkPaidOrders,
  checkPaymentConfig,
} from '@/lib/health/payments';
import { errorText } from '@/lib/health/redact';

// Every request runs live checks, so this route must never be cached by Next.js.
export const dynamic = 'force-dynamic';

const CHECK_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;
const CONTENT_TYPE = 'application/health+json';
// Every answer is live. No browser, CDN or proxy may keep a copy.
const NO_STORE = { 'Cache-Control': 'no-store' };

interface HealthBody {
  status: CheckStatus;
  checks: Record<string, CheckResult>;
  time: string;
}

type Group = 'core' | 'payments' | 'callbacks';

interface HealthCheck {
  name: string;
  group: Group;
  run: () => Promise<CheckResult>;
  // The hint shown with any failure of this check.
  fix: string;
}

// Each check sits in one group. Callback failures stay red for 24 hours, so they
// have their own group. Elsewhere they would hide a new paid-order failure.
const CHECKS: HealthCheck[] = [
  { name: 'database', group: 'core', run: checkDatabase, fix: '到 Supabase 後台查專案狀態（是否被暫停、是否超過用量）' },
  { name: 'auth', group: 'core', run: checkAuth, fix: '到 Supabase → Authentication → Providers 打開 Google 或 Email' },
  {
    name: 'dictionaryStore',
    group: 'core',
    run: checkDictionaryStore,
    fix: '到 Vercel → Storage 查 txtconv-prod-dictionaries 是否被停用，以及帳單和用量',
  },
  {
    name: 'paymentConfig',
    group: 'payments',
    run: checkPaymentConfig,
    fix: '照維運手冊「三、合併上線前檢查」第 1 步補齊 Vercel 正式環境變數',
  },
  { name: 'paidOrders', group: 'payments', run: checkPaidOrders, fix: '照維運手冊「二、對帳查詢」A 手動開通' },
  {
    name: 'doublePaid',
    group: 'payments',
    run: checkDoublePaid,
    fix: '照維運手冊「二、對帳查詢」B 退款，再把多的那筆標成 refunded',
  },
  {
    name: 'callbackFailures',
    group: 'callbacks',
    run: checkCallbackFailures,
    fix: '查 Vercel 紀錄 "ecpay/callback"，再到綠界後台核對這筆訂單',
  },
];

const GROUPS = new Set<string>(CHECKS.map((c) => c.group));

// Caches each group's answer for a minute.
// Pollers then do not hit Supabase and Blob on every request.
// Requests that arrive during a computation share its promise.
const cache = new Map<string, { expiresAt: number; promise: Promise<HealthBody> }>();

// Runs one check and always returns a result.
// A throw, a rejection or a timeout becomes a fail. The page then always answers.
// A thrown error is logged with secrets removed, so its cause is not lost.
// Every failure carries the check's fix hint unless the check gave its own.
async function runCheck(check: HealthCheck): Promise<CheckResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<CheckResult>((resolve) => {
    timer = setTimeout(
      () => resolve({ status: 'fail', output: `逾時（${CHECK_TIMEOUT_MS / 1000} 秒）` }),
      CHECK_TIMEOUT_MS,
    );
  });
  try {
    const result = await Promise.race([Promise.resolve().then(check.run), timeout]);
    return result.status === 'fail' && !result.fix ? { ...result, fix: check.fix } : result;
  } catch (err) {
    const output = errorText(err);
    console.error('health check failed:', check.name, output);
    return { status: 'fail', output, fix: check.fix };
  } finally {
    clearTimeout(timer);
  }
}

// Compares the request key with the configured key in constant time.
// A missing configured key denies every request.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.HEALTH_CHECK_KEY;
  if (!expected) return false;
  const given = Buffer.from(request.nextUrl.searchParams.get('key') ?? '');
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

// Any failed check makes the whole report fail.
function overallStatus(results: CheckResult[]): CheckStatus {
  return results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
}

// Runs the checks of a group in parallel and builds the response body.
// The group 'all' means every check.
async function computeHealth(group: string): Promise<HealthBody> {
  const selected = CHECKS.filter((c) => group === 'all' || c.group === group);
  const results = await Promise.all(selected.map(runCheck));
  return {
    status: overallStatus(results),
    checks: Object.fromEntries(selected.map((c, i) => [c.name, results[i]])),
    time: new Date().toISOString(),
  };
}

// Returns the cached answer for a group, or starts one computation for it.
// The entry expires 60 seconds after it starts.
// A rejected computation then expires within 60 seconds by itself.
function healthFor(group: string): Promise<HealthBody> {
  const cached = cache.get(group);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const entry = { expiresAt: Date.now() + CACHE_TTL_MS, promise: computeHealth(group) };
  cache.set(group, entry);
  return entry.promise;
}

/**
 * Returns the grouped health report that UptimeRobot polls.
 * The optional group query (core, payments or callbacks) limits the report to one group.
 * It answers 503 when any check fails, so the monitor alerts on any non-2xx.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ status: 'fail' }, { status: 401, headers: NO_STORE });
  }

  const requested = request.nextUrl.searchParams.get('group');
  if (requested && !GROUPS.has(requested)) {
    return NextResponse.json({ status: 'fail' }, { status: 400, headers: NO_STORE });
  }

  // A missing or empty group means every check.
  const body = await healthFor(requested || 'all');
  return new NextResponse(JSON.stringify(body), {
    status: body.status === 'fail' ? 503 : 200,
    headers: { 'Content-Type': CONTENT_TYPE, ...NO_STORE },
  });
}
