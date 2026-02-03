import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { validateDictionary, parseDictionary, getDictPairLimit } from '@/lib/custom-dict';
import type { LicenseType } from '@/types/user';

export const runtime = 'nodejs';

/**
 * GET /api/dictionary
 * Returns the user's custom dictionary content and pair count.
 */
export async function GET() {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  // Fetch profile using service client (bypass RLS)
  const serviceClient = createServiceClient();
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('custom_dict_url')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ content: '', pairCount: 0 });
  }

  // If no dictionary URL, return empty
  if (!profile.custom_dict_url) {
    return NextResponse.json({ content: '', pairCount: 0 });
  }

  // Fetch dictionary content from Vercel Blob
  try {
    const response = await fetch(profile.custom_dict_url);
    if (!response.ok) {
      return NextResponse.json({ content: '', pairCount: 0 });
    }
    const content = await response.text();
    const pairs = parseDictionary(content);
    return NextResponse.json({ content, pairCount: pairs.length });
  } catch {
    return NextResponse.json({ content: '', pairCount: 0 });
  }
}

/**
 * POST /api/dictionary
 * Saves the user's custom dictionary content.
 * Body: { content: string } (raw CSV text)
 */
export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  // Parse request body
  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '請提供有效的 JSON' }, { status: 400 });
  }

  const content = body.content ?? '';

  // Validate dictionary format
  const errors = validateDictionary(content);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 400 });
  }

  // Fetch profile to get license_type
  const serviceClient = createServiceClient();
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, license_type')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: '找不到使用者資料' }, { status: 404 });
  }

  // Check pair count against limit
  const pairs = parseDictionary(content);
  const licenseType = profile.license_type as LicenseType;
  const limit = getDictPairLimit(licenseType);

  if (pairs.length > limit) {
    const limitMsg = licenseType === 'free'
      ? `超過上限：免費版最多 ${limit} 組對照`
      : `超過上限：付費版最多 ${limit} 組對照`;
    return NextResponse.json({ error: limitMsg }, { status: 400 });
  }

  // If content is empty, clear the dictionary URL instead of uploading an empty blob
  if (content.trim() === '') {
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ custom_dict_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
    }

    return NextResponse.json({ success: true, pairCount: 0 });
  }

  // Upload to Vercel Blob
  try {
    const blob = await put(`dictionaries/${user.id}.csv`, content, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true, // Required for updating existing dictionaries
      contentType: 'text/csv; charset=utf-8',
    });

    // Update profile with blob URL
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update({ custom_dict_url: blob.url, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
    }

    return NextResponse.json({ success: true, pairCount: pairs.length });
  } catch (error) {
    console.error('Vercel Blob upload error:', error);
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 });
  }
}
