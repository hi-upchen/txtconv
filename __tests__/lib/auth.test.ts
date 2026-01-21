import { isPaidUser } from '@/lib/auth';
import type { Profile } from '@/types/user';

describe('isPaidUser', () => {
  const baseProfile: Profile = {
    id: '123',
    email: 'test@example.com',
    license_type: 'free',
    license_expires_at: null,
    gumroad_purchase_id: null,
    gumroad_product_id: null,
    purchased_at: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  it('returns false for free users', () => {
    const profile = { ...baseProfile, license_type: 'free' as const };
    expect(isPaidUser(profile)).toBe(false);
  });

  it('returns true for lifetime users', () => {
    const profile = { ...baseProfile, license_type: 'lifetime' as const };
    expect(isPaidUser(profile)).toBe(true);
  });

  it('returns true for monthly users with valid subscription', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const profile = {
      ...baseProfile,
      license_type: 'monthly' as const,
      license_expires_at: futureDate.toISOString(),
    };
    expect(isPaidUser(profile)).toBe(true);
  });

  it('returns false for monthly users with expired subscription', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const profile = {
      ...baseProfile,
      license_type: 'monthly' as const,
      license_expires_at: pastDate.toISOString(),
    };
    expect(isPaidUser(profile)).toBe(false);
  });

  it('returns false for null profile', () => {
    expect(isPaidUser(null)).toBe(false);
  });
});
