/**
 * @jest-environment node
 */
/**
 * Tests for the grouped health page that UptimeRobot polls.
 * Both check modules are mocked. Each test loads a fresh route module,
 * so the 60 second result cache starts empty.
 */
import { NextRequest } from 'next/server';

// The mock functions live outside the factories so they survive the module
// reset that loadRoute performs.
const mockCore = {
  checkDatabase: jest.fn(),
  checkAuth: jest.fn(),
  checkDictionaryStore: jest.fn(),
};
const mockPay = {
  checkPaymentConfig: jest.fn(),
  checkPaidOrders: jest.fn(),
  checkDoublePaid: jest.fn(),
  checkCallbackFailures: jest.fn(),
};
jest.mock('@/lib/health/checks', () => ({
  checkDatabase: (...a: unknown[]) => mockCore.checkDatabase(...a),
  checkAuth: (...a: unknown[]) => mockCore.checkAuth(...a),
  checkDictionaryStore: (...a: unknown[]) => mockCore.checkDictionaryStore(...a),
}));
jest.mock('@/lib/health/payments', () => ({
  checkPaymentConfig: (...a: unknown[]) => mockPay.checkPaymentConfig(...a),
  checkPaidOrders: (...a: unknown[]) => mockPay.checkPaidOrders(...a),
  checkDoublePaid: (...a: unknown[]) => mockPay.checkDoublePaid(...a),
  checkCallbackFailures: (...a: unknown[]) => mockPay.checkCallbackFailures(...a),
}));

const KEY = 'test-health-key';
const pass = { status: 'pass' };
const CORE = ['auth', 'database', 'dictionaryStore'];
const PAYMENTS = ['doublePaid', 'paidOrders', 'paymentConfig'];
const CALLBACKS = ['callbackFailures'];
const AUTH_FIX = '到 Supabase → Authentication → Providers 打開 Google 或 Email';
const DICTIONARY_FIX = '到 Vercel → Storage 查 txtconv-prod-dictionaries 是否被停用，以及帳單和用量';

function req(key?: string, group?: string): NextRequest {
  const params = new URLSearchParams();
  if (key !== undefined) params.set('key', key);
  if (group !== undefined) params.set('group', group);
  return new NextRequest(`http://localhost/api/health?${params}`);
}

async function loadRoute() {
  jest.resetModules();
  return import('@/app/api/health/route');
}

const allMocks = () => [...Object.values(mockCore), ...Object.values(mockPay)];

// Maps each check name to its mock, so a test can see which checks ran.
const MOCK_BY_NAME: Record<string, jest.Mock> = {
  database: mockCore.checkDatabase,
  auth: mockCore.checkAuth,
  dictionaryStore: mockCore.checkDictionaryStore,
  paymentConfig: mockPay.checkPaymentConfig,
  paidOrders: mockPay.checkPaidOrders,
  doublePaid: mockPay.checkDoublePaid,
  callbackFailures: mockPay.checkCallbackFailures,
};

describe('GET /api/health', () => {
  const ORIGINAL_KEY = process.env.HEALTH_CHECK_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env.HEALTH_CHECK_KEY = KEY;
    allMocks().forEach((m) => m.mockResolvedValue(pass));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    if (ORIGINAL_KEY === undefined) delete process.env.HEALTH_CHECK_KEY;
    else process.env.HEALTH_CHECK_KEY = ORIGINAL_KEY;
  });

  it('returns 401 with {status:fail} for a missing, wrong, same-length wrong or empty key', async () => {
    const { GET } = await loadRoute();
    const sameLength = 'x'.repeat(KEY.length);
    for (const r of [req(), req('wrong-key-value'), req(sameLength), req('')]) {
      const res = await GET(r);
      expect(res.status).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(await res.json()).toEqual({ status: 'fail' });
    }
    allMocks().forEach((m) => expect(m).not.toHaveBeenCalled());
  });

  it('returns 401 for every request, including an empty key, when HEALTH_CHECK_KEY is unset', async () => {
    delete process.env.HEALTH_CHECK_KEY;
    const { GET } = await loadRoute();
    for (const r of [req(''), req(KEY), req()]) {
      const res = await GET(r);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ status: 'fail' });
    }
  });

  it('returns 400 for an unknown group, after the key check', async () => {
    const { GET } = await loadRoute();
    const res = await GET(req(KEY, 'nope'));
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ status: 'fail' });
    expect((await GET(req('wrong-key-value', 'nope'))).status).toBe(401);
    allMocks().forEach((m) => expect(m).not.toHaveBeenCalled());
  });

  it.each([
    ['core', CORE],
    ['payments', PAYMENTS],
    ['callbacks', CALLBACKS],
    [undefined, [...CORE, ...PAYMENTS, ...CALLBACKS]],
  ])('group %s runs exactly its own checks', async (group, names) => {
    const { GET } = await loadRoute();
    const res = await GET(req(KEY, group));
    expect(res.status).toBe(200);
    expect(Object.keys((await res.json()).checks).sort()).toEqual([...names].sort());
    for (const [name, mock] of Object.entries(MOCK_BY_NAME)) {
      expect(mock.mock.calls.length > 0).toBe(names.includes(name));
    }
  });

  it('keeps payments green when only a callback failure is recorded', async () => {
    mockPay.checkCallbackFailures.mockResolvedValue({ status: 'fail', output: '付款金額不符，訂單 TC1' });
    const { GET } = await loadRoute();
    expect((await GET(req(KEY, 'payments'))).status).toBe(200);
    expect((await GET(req(KEY, 'callbacks'))).status).toBe(503);
  });

  it('answers 200 with health+json and the body shape when all pass', async () => {
    const { GET } = await loadRoute();
    const res = await GET(req(KEY));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/health+json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('pass');
    expect(body.checks.database).toEqual(pass);
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
    expect(JSON.stringify(body)).not.toContain(KEY);
  });

  it('answers 503 and keeps output and fix when a check fails', async () => {
    mockPay.checkPaidOrders.mockResolvedValue({ status: 'fail', output: 'TC1', fix: '照手冊' });
    const { GET } = await loadRoute();
    const res = await GET(req(KEY, 'payments'));
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.status).toBe('fail');
    expect(body.checks.paidOrders).toEqual({ status: 'fail', output: 'TC1', fix: '照手冊' });
  });

  it('adds the fix hint to a failure that has none', async () => {
    mockCore.checkAuth.mockResolvedValue({ status: 'fail', output: 'Supabase 未開啟 Google 登入' });
    const { GET } = await loadRoute();
    const body = await (await GET(req(KEY, 'core'))).json();
    expect(body.checks.auth).toEqual({ status: 'fail', output: 'Supabase 未開啟 Google 登入', fix: AUTH_FIX });
    expect(body.checks.database).toEqual(pass);
  });

  it('turns a throwing check into a fail with the redacted error and the fix, and logs it', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-key';
    mockCore.checkAuth.mockRejectedValue(new Error('boom super-secret-service-key'));
    const { GET } = await loadRoute();
    const res = await GET(req(KEY, 'core'));
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(res.status).toBe(503);
    expect((await res.json()).checks.auth).toEqual({ status: 'fail', output: 'boom ***', fix: AUTH_FIX });
    const logged = JSON.stringify((console.error as jest.Mock).mock.calls);
    expect(logged).toContain('auth');
    expect(logged).toContain('boom');
    expect(logged).not.toContain('super-secret-service-key');
  });

  it('turns a check that never settles into a fail with 逾時（8 秒）', async () => {
    jest.useFakeTimers();
    mockCore.checkDictionaryStore.mockReturnValue(new Promise(() => {}));
    const { GET } = await loadRoute();
    const pending = GET(req(KEY, 'core'));
    await jest.advanceTimersByTimeAsync(8_000);
    const res = await pending;
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.dictionaryStore).toEqual({ status: 'fail', output: '逾時（8 秒）', fix: DICTIONARY_FIX });
    expect(body.checks.database.status).toBe('pass');
  });

  it('reuses the cached body for 60 seconds', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const { GET } = await loadRoute();
    const first = await (await GET(req(KEY))).json();
    now += 59_000;
    const second = await (await GET(req(KEY))).json();
    expect(second.time).toBe(first.time);
    expect(mockCore.checkDatabase).toHaveBeenCalledTimes(1);
    now += 2_000;
    await GET(req(KEY));
    expect(mockCore.checkDatabase).toHaveBeenCalledTimes(2);
  });

  it('expires a rejected computation after 60 seconds', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    // A logger that throws inside the error path makes the whole computation reject.
    mockCore.checkAuth.mockRejectedValueOnce(new Error('boom'));
    (console.error as jest.Mock).mockImplementationOnce(() => {
      throw new Error('log sink down');
    });
    const { GET } = await loadRoute();
    await expect(GET(req(KEY, 'core'))).rejects.toThrow('log sink down');
    now += 59_000;
    await expect(GET(req(KEY, 'core'))).rejects.toThrow('log sink down');
    expect(mockCore.checkDatabase).toHaveBeenCalledTimes(1);
    now += 2_000;
    expect((await GET(req(KEY, 'core'))).status).toBe(200);
    expect(mockCore.checkDatabase).toHaveBeenCalledTimes(2);
  });

  it('caches each group separately', async () => {
    const { GET } = await loadRoute();
    await GET(req(KEY, 'core'));
    await GET(req(KEY, 'payments'));
    expect(mockCore.checkDatabase).toHaveBeenCalledTimes(1);
    expect(mockPay.checkPaidOrders).toHaveBeenCalledTimes(1);
  });

  it('shares one computation between concurrent requests', async () => {
    let release: (value: unknown) => void = () => {};
    mockCore.checkDatabase.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { GET } = await loadRoute();
    const first = GET(req(KEY, 'core'));
    const second = GET(req(KEY, 'core'));
    await new Promise((r) => setImmediate(r));
    release(pass);
    await Promise.all([first, second]);
    expect(mockCore.checkDatabase).toHaveBeenCalledTimes(1);
  });
});
