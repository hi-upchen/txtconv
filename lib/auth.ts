import type { Profile } from '@/types/user';

export function isPaidUser(profile: Profile | null): boolean {
  if (!profile) return false;

  if (profile.license_type === 'lifetime') return true;

  if (profile.license_type === 'monthly') {
    if (!profile.license_expires_at) return false;
    return new Date(profile.license_expires_at) > new Date();
  }

  return false;
}
