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
 * Usage:
 *   NEXT_PUBLIC_APP_URL=https://<ngrok> npx --yes tsx scripts/ecpay-e2e-user.ts create
 *   npx --yes tsx scripts/ecpay-e2e-user.ts delete <userId>
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

  return { userId: created.user.id, email, loginUrl };
}

/** Removes the user's orders, profile row and auth account. Safe to call twice. */
export async function deleteE2eUser(userId: string): Promise<void> {
  const supabase = adminClient();

  const { error: ordersError } = await supabase.from('ecpay_orders').delete().eq('user_id', userId);
  if (ordersError) throw new Error(`deleting ecpay_orders failed: ${ordersError.message}`);

  const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
  if (profileError) throw new Error(`deleting profile failed: ${profileError.message}`);

  const { error: userError } = await supabase.auth.admin.deleteUser(userId);
  if (userError && !/not found/i.test(userError.message)) {
    throw new Error(`deleteUser failed: ${userError.message}`);
  }
}

/** Command-line entry: `create` prints the user as JSON, `delete <userId>` removes it. */
async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  if (command === 'create') {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL must be the public app URL');
    console.log(JSON.stringify(await createE2eUser(appUrl), null, 2));
    return;
  }
  if (command === 'delete' && arg) {
    await deleteE2eUser(arg);
    console.log(`deleted ${arg}`);
    return;
  }
  throw new Error('usage: ecpay-e2e-user.ts create | delete <userId>');
}

// Run only when invoked directly. The sandbox spec imports the functions.
if (process.argv[1] && process.argv[1].endsWith('ecpay-e2e-user.ts')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
