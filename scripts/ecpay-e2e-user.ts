// scripts/ecpay-e2e-user.ts
/**
 * Creates and deletes the throwaway Supabase user for the ECPay sandbox run.
 *
 * It is a real free account in the real project, not the dev mock user.
 * So the create route can store an order for it.
 *
 * Login works without email. `auth.admin.generateLink({ type: 'magiclink' })`
 * returns `properties.hashed_token`. Our /auth/confirm route trades that hash
 * for a session cookie with `verifyOtp({ type: 'magiclink', token_hash })`.
 * Do not open the returned `action_link`. It puts tokens in the URL fragment,
 * and our cookie session never reads them there.
 *
 * Deletes only touch throwaway accounts. Their emails match E2E_EMAIL_PATTERN.
 *
 * Usage:
 *   NEXT_PUBLIC_APP_URL=https://<ngrok> npx --yes tsx scripts/ecpay-e2e-user.ts create
 *   npx --yes tsx scripts/ecpay-e2e-user.ts delete <userId>
 *   npx --yes tsx scripts/ecpay-e2e-user.ts cleanup
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

loadEnv({ path: '.env.local', quiet: true });

export interface E2eUser {
  userId: string;
  email: string;
  /** Opens /auth/confirm and lands on /checkout, logged in. Works once. */
  loginUrl: string;
}

/** Rows removed by one deleteE2eUser call. */
export interface E2eDeleteResult {
  orders: number;
  profiles: number;
  authUsers: number;
}

/** Matches only the throwaway addresses that createE2eUser makes. */
export const E2E_EMAIL_PATTERN = /^ecpay-e2e\+\d+@txtconv\.local$/;

/** The same addresses as a Postgres LIKE pattern. Each delete filters on it too. */
const E2E_EMAIL_LIKE = 'ecpay-e2e+%@txtconv.local';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Service-role client. A script never keeps a session. */
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Creates a confirmed user with a unique address and returns a one-shot login URL.
 *
 * If a later step fails, it deletes the new user and then rethrows.
 * So a failed create leaves no stray account behind.
 *
 * @param appUrl - Public base URL of the running app, the ngrok https URL.
 */
export async function createE2eUser(appUrl: string): Promise<E2eUser> {
  const supabase = adminClient();
  const email = `ecpay-e2e+${Date.now()}@txtconv.local`;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    throw new Error(`createUser failed: ${createError?.message ?? 'no user returned'}`);
  }
  const userId = created.user.id;

  try {
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const hashedToken = link?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      throw new Error(`generateLink failed: ${linkError?.message ?? 'no hashed_token returned'}`);
    }

    const base = appUrl.replace(/\/+$/, '');
    const loginUrl =
      `${base}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}` +
      `&type=magiclink&next=${encodeURIComponent('/checkout')}`;

    return { userId, email, loginUrl };
  } catch (err) {
    await deleteE2eUser(userId).catch((cleanupErr: unknown) => {
      console.error('cleanup after a failed create also failed:', cleanupErr);
    });
    throw err;
  }
}

/**
 * Removes one throwaway user: its orders, its profile row and its auth account.
 *
 * The project is the real production database, so it refuses every other account.
 *   - The id must be a UUID.
 *   - The auth account's email must match E2E_EMAIL_PATTERN exactly.
 * A refusal throws before anything is deleted.
 * An auth account that is already gone counts as done.
 */
export async function deleteE2eUser(userId: string): Promise<E2eDeleteResult> {
  if (!UUID_PATTERN.test(userId)) {
    throw new Error(`refusing to delete: "${userId}" is not a UUID`);
  }
  const supabase = adminClient();

  const { data: found, error: getError } = await supabase.auth.admin.getUserById(userId);
  if (getError || !found?.user) {
    const status = (getError as { status?: number } | null)?.status;
    if (!getError || status === 404 || /not found/i.test(getError.message)) {
      return { orders: 0, profiles: 0, authUsers: 0 };
    }
    throw new Error(`getUserById failed: ${getError.message}`);
  }
  if (!E2E_EMAIL_PATTERN.test(found.user.email ?? '')) {
    throw new Error(`refusing to delete ${userId}: it is not a throwaway sandbox account`);
  }

  const { count: orders, error: ordersError } = await supabase
    .from('ecpay_orders')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .like('email', E2E_EMAIL_LIKE);
  if (ordersError) throw new Error(`deleting ecpay_orders failed: ${ordersError.message}`);

  const { count: profiles, error: profileError } = await supabase
    .from('profiles')
    .delete({ count: 'exact' })
    .eq('id', userId)
    .like('email', E2E_EMAIL_LIKE);
  if (profileError) throw new Error(`deleting profile failed: ${profileError.message}`);

  const { error: userError } = await supabase.auth.admin.deleteUser(userId);
  if (userError && !/not found/i.test(userError.message)) {
    throw new Error(`deleteUser failed: ${userError.message}`);
  }

  return { orders: orders ?? 0, profiles: profiles ?? 0, authUsers: userError ? 0 : 1 };
}

/** Lists every auth account whose email matches E2E_EMAIL_PATTERN. It reads all pages. */
export async function listE2eUsers(): Promise<Array<{ id: string; email: string }>> {
  const supabase = adminClient();
  const perPage = 1000;
  const matches: Array<{ id: string; email: string }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email && E2E_EMAIL_PATTERN.test(u.email)) matches.push({ id: u.id, email: u.email });
    }
    if (data.users.length < perPage) break;
  }
  return matches;
}

/**
 * Command-line entry.
 *   - `create` prints a new user as JSON.
 *   - `delete <userId>` removes one throwaway user.
 *   - `cleanup` finds every throwaway user and removes each one.
 * Every delete goes through the guarded deleteE2eUser.
 */
async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  if (command === 'create') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL must be the public app URL');
    console.log(JSON.stringify(await createE2eUser(appUrl), null, 2));
    return;
  }
  if (command === 'delete' && arg) {
    const result = await deleteE2eUser(arg);
    console.log(`deleted ${arg} ${JSON.stringify(result)}`);
    return;
  }
  if (command === 'cleanup') {
    const users = await listE2eUsers();
    console.log(`found ${users.length} throwaway users`);
    const total: E2eDeleteResult = { orders: 0, profiles: 0, authUsers: 0 };
    for (const u of users) {
      const result = await deleteE2eUser(u.id);
      console.log(`deleted ${u.id} ${u.email} ${JSON.stringify(result)}`);
      total.orders += result.orders;
      total.profiles += result.profiles;
      total.authUsers += result.authUsers;
    }
    console.log(`total ${JSON.stringify(total)}`);
    return;
  }
  throw new Error('usage: ecpay-e2e-user.ts create | delete <userId> | cleanup');
}

// Run only when invoked directly. The sandbox spec imports the functions.
if (process.argv[1] && process.argv[1].endsWith('ecpay-e2e-user.ts')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
