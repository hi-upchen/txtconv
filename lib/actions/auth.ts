'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/user';

export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId: string): Promise<Profile | null> {
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
