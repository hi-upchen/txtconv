import { list } from '@vercel/blob';
import { createServiceClient } from '@/lib/supabase/server';

export type CheckStatus = 'pass' | 'fail';

export interface CheckResult {
  status: CheckStatus;
  output?: string;
  fix?: string;
}

// Each request stops after 8 seconds. It then does not hang on after its check timed out.
const FETCH_TIMEOUT_MS = 8_000;

// Reads one row from the profiles table.
// A paused or unreachable Supabase project makes this throw.
export async function checkDatabase(): Promise<CheckResult> {
  const { error } = await createServiceClient().from('profiles').select('id').limit(1);
  if (error) throw new Error(error.message);
  return { status: 'pass' };
}

// Reads the public Supabase Auth settings.
// It fails if the service is down or the Google or Email login is switched off.
export async function checkAuth(): Promise<CheckResult> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status !== 200) {
    return { status: 'fail', output: `Supabase 登入服務回應 HTTP ${response.status}` };
  }
  const settings = await response.json();
  if (!settings?.external?.google) return { status: 'fail', output: 'Supabase 未開啟 Google 登入' };
  if (!settings?.external?.email) return { status: 'fail', output: 'Supabase 未開啟 Email 登入' };
  return { status: 'pass' };
}

// Lists one dictionary blob and sends a HEAD request for it.
// HEAD proves the file is served without downloading its body.
// An empty store passes. This only reads, it never writes to the store.
export async function checkDictionaryStore(): Promise<CheckResult> {
  const { blobs } = await list({ limit: 1, prefix: 'dictionaries/' });
  if (blobs.length === 0) return { status: 'pass' };
  const response = await fetch(blobs[0].url, {
    method: 'HEAD',
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return { status: 'fail', output: `字典儲存空間回應 HTTP ${response.status}` };
  return { status: 'pass' };
}
