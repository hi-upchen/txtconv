'use server';

import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/user';
import type { User } from '@supabase/supabase-js';
import { TEST_USER_ID } from '@/lib/test-user';

/**
 * Check if test login is enabled (dev only).
 */
function isTestLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_TEST_LOGIN === 'true';
}

/**
 * Get test session from cookie if valid.
 */
async function getTestSession(): Promise<{ userId: string; email: string } | null> {
  if (!isTestLoginEnabled()) return null;

  try {
    const cookieStore = await cookies();
    const testSessionCookie = cookieStore.get('test-session');
    if (!testSessionCookie) return null;

    const session = JSON.parse(testSessionCookie.value);
    if (session?.user?.id === TEST_USER_ID) {
      return { userId: session.user.id, email: session.user.email };
    }
  } catch {
    // Invalid cookie format
  }
  return null;
}

export async function getAuthUser(): Promise<User | null> {
  // Check for test session first (dev only)
  const testSession = await getTestSession();
  if (testSession) {
    return {
      id: testSession.userId,
      email: testSession.email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '',
    } as User;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  // Return mock profile for test user (dev only)
  if (isTestLoginEnabled() && userId === TEST_USER_ID) {
    return {
      id: TEST_USER_ID,
      email: 'test@txtconv.local',
      license_type: 'lifetime',
      custom_dict_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Profile;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  return data;
}

export async function ensureProfileLinked(userId: string, email: string): Promise<void> {
  // Use service client to bypass RLS — this is an admin-level linking operation
  const supabase = createServiceClient();

  // 1. Check if profile exists with this auth user ID
  const { data: existingById } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  // 2. Check if a separate profile exists by email (created by webhook with random UUID)
  const { data: orphanByEmail } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .neq('id', userId)
    .maybeSingle();

  if (existingById && orphanByEmail) {
    // Both exist: merge license data from orphan into the auth-user profile, then delete orphan
    if (orphanByEmail.license_type !== 'free') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          license_type: orphanByEmail.license_type,
          license_expires_at: orphanByEmail.license_expires_at,
          gumroad_purchase_id: orphanByEmail.gumroad_purchase_id,
          gumroad_product_id: orphanByEmail.gumroad_product_id,
          purchased_at: orphanByEmail.purchased_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error merging profile data:', updateError);
        return; // Don't delete orphan if merge failed
      }
    }
    await supabase.from('profiles').delete().eq('id', orphanByEmail.id);
    return;
  }

  if (existingById) return; // Already linked, no orphan to merge

  if (orphanByEmail) {
    // Only orphan exists: claim it by delete + insert with auth user ID
    await supabase.from('profiles').delete().eq('id', orphanByEmail.id);

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: orphanByEmail.email,
        license_type: orphanByEmail.license_type,
        license_expires_at: orphanByEmail.license_expires_at,
        gumroad_purchase_id: orphanByEmail.gumroad_purchase_id,
        gumroad_product_id: orphanByEmail.gumroad_product_id,
        purchased_at: orphanByEmail.purchased_at,
      });

    if (error) {
      console.error('Error claiming orphan profile:', error);
    }
    return;
  }

  // No profile at all — create a fresh free profile
  const { error } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email,
      license_type: 'free',
    });

  if (error) {
    console.error('Error creating new profile:', error);
  }
}
