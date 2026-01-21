# Purchase System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase auth + Gumroad payment integration to txtconv, allowing users to purchase lifetime Pro access.

**Architecture:** Email-based authentication via Supabase magic links. Gumroad handles payment, sends webhook to create/update user profiles. UI shows login state and Pro badge for paid users.

**Tech Stack:** Next.js 14, Supabase Auth + Database, Gumroad API/Webhooks, Bulma CSS

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Supabase packages**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr
```

Expected: Packages added to dependencies

**Step 2: Verify installation**

Run:
```bash
npm ls @supabase/supabase-js @supabase/ssr
```

Expected: Both packages listed

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Supabase dependencies"
```

---

## Task 2: Add Environment Variables

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (manually)

**Step 1: Update .env.example**

Add to `.env.example`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gumroad
GUMROAD_SELLER_ID=your-seller-id
GUMROAD_LIFETIME_PRODUCT_ID=your-product-id

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add Supabase and Gumroad env vars to example"
```

**Step 3: Configure .env.local (manual)**

User must manually copy values from Supabase dashboard and Gumroad settings.

---

## Task 3: Create Type Definitions

**Files:**
- Create: `types/user.ts`

**Step 1: Create types file**

Create `types/user.ts`:
```typescript
export type LicenseType = 'free' | 'lifetime' | 'monthly';

export interface Profile {
  id: string;
  email: string;
  license_type: LicenseType;
  license_expires_at: string | null;
  gumroad_purchase_id: string | null;
  gumroad_product_id: string | null;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GumroadWebhookPayload {
  seller_id: string;
  product_id: string;
  product_name: string;
  email: string;
  sale_id: string;
  sale_timestamp: string;
  price: number;
  is_recurring_charge: boolean;
  recurrence?: string;
  variants?: Record<string, string>;
  license_key?: string;
  ip_country?: string;
  refunded?: boolean;
  resource_name: string;
}
```

**Step 2: Commit**

```bash
git add types/user.ts
git commit -m "feat: add user and license type definitions"
```

---

## Task 4: Create Supabase Client

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`

**Step 1: Create browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - ignore
          }
        },
      },
    }
  );
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}
```

**Step 3: Create middleware helper**

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

**Step 4: Commit**

```bash
git add lib/supabase/
git commit -m "feat: add Supabase client utilities"
```

---

## Task 5: Create Middleware

**Files:**
- Create: `middleware.ts`

**Step 1: Create middleware**

Create `middleware.ts` in project root:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Supabase session middleware"
```

---

## Task 6: Create Auth Helpers

**Files:**
- Create: `lib/auth.ts`
- Create: `__tests__/lib/auth.test.ts`

**Step 1: Write the failing test**

Create `__tests__/lib/auth.test.ts`:
```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/lib/auth.test.ts`

Expected: FAIL with "Cannot find module '@/lib/auth'"

**Step 3: Write implementation**

Create `lib/auth.ts`:
```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/lib/auth.test.ts`

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add lib/auth.ts __tests__/lib/auth.test.ts
git commit -m "feat: add isPaidUser helper with tests"
```

---

## Task 7: Create Auth Callback Route

**Files:**
- Create: `app/auth/callback/route.ts`

**Step 1: Create callback handler**

Create `app/auth/callback/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
```

**Step 2: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: add Supabase auth callback route"
```

---

## Task 8: Create AuthButton Component

**Files:**
- Create: `components/AuthButton.tsx`
- Create: `__tests__/components/AuthButton.test.tsx`

**Step 1: Write the failing test**

Create `__tests__/components/AuthButton.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react';
import AuthButton from '@/components/AuthButton';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

describe('AuthButton', () => {
  it('shows login button when not authenticated', async () => {
    render(<AuthButton user={null} profile={null} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('shows user email when authenticated', async () => {
    const user = { email: 'test@example.com' };
    render(<AuthButton user={user as any} profile={null} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/components/AuthButton.test.tsx`

Expected: FAIL with "Cannot find module '@/components/AuthButton'"

**Step 3: Write implementation**

Create `components/AuthButton.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import { isPaidUser } from '@/lib/auth';

interface AuthButtonProps {
  user: User | null;
  profile: Profile | null;
}

export default function AuthButton({ user, profile }: AuthButtonProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Check your email for the magic link!');
      setEmail('');
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!user) {
    return (
      <>
        <button
          className="button is-light"
          onClick={() => setShowModal(true)}
        >
          Login
        </button>

        {showModal && (
          <div className={`modal ${showModal ? 'is-active' : ''}`}>
            <div className="modal-background" onClick={() => setShowModal(false)} />
            <div className="modal-card">
              <header className="modal-card-head">
                <p className="modal-card-title">Login</p>
                <button
                  className="delete"
                  aria-label="close"
                  onClick={() => setShowModal(false)}
                />
              </header>
              <section className="modal-card-body">
                <form onSubmit={handleLogin}>
                  <div className="field">
                    <label className="label">Email</label>
                    <div className="control">
                      <input
                        className="input"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {message && (
                    <div className={`notification ${message.includes('Check') ? 'is-success' : 'is-danger'} is-light`}>
                      {message}
                    </div>
                  )}
                  <button
                    className={`button is-primary is-fullwidth ${isLoading ? 'is-loading' : ''}`}
                    type="submit"
                    disabled={isLoading}
                  >
                    Send Magic Link
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`dropdown ${showDropdown ? 'is-active' : ''}`}>
      <div className="dropdown-trigger">
        <button
          className="button is-light"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <span>{user.email}</span>
          {isPaidUser(profile) && (
            <span className="tag is-warning ml-2">Pro</span>
          )}
          <span className="icon is-small">
            <i className="fas fa-angle-down" aria-hidden="true" />
          </span>
        </button>
      </div>
      <div className="dropdown-menu">
        <div className="dropdown-content">
          <div className="dropdown-item">
            <p className="is-size-7 has-text-grey">
              {isPaidUser(profile) ? 'Pro Account' : 'Free Account'}
            </p>
          </div>
          <hr className="dropdown-divider" />
          <a className="dropdown-item" onClick={handleLogout}>
            Logout
          </a>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/components/AuthButton.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add components/AuthButton.tsx __tests__/components/AuthButton.test.tsx
git commit -m "feat: add AuthButton component with magic link login"
```

---

## Task 9: Create ProBadge Component

**Files:**
- Create: `components/ProBadge.tsx`

**Step 1: Create component**

Create `components/ProBadge.tsx`:
```typescript
interface ProBadgeProps {
  className?: string;
}

export default function ProBadge({ className = '' }: ProBadgeProps) {
  return (
    <span className={`tag is-warning ${className}`}>
      <span className="icon is-small mr-1">
        <i className="fas fa-star" />
      </span>
      Pro
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add components/ProBadge.tsx
git commit -m "feat: add ProBadge component"
```

---

## Task 10: Create PricingSection Component

**Files:**
- Create: `components/PricingSection.tsx`

**Step 1: Create component**

Create `components/PricingSection.tsx`:
```typescript
'use client';

interface PricingSectionProps {
  gumroadUrl?: string;
}

export default function PricingSection({
  gumroadUrl = 'https://gumroad.com/l/YOUR_PRODUCT_ID'
}: PricingSectionProps) {
  return (
    <section className="section" id="pricing">
      <div className="container">
        <h2 className="title has-text-centered mb-6">方案價格</h2>

        <div className="columns is-centered">
          {/* Free Tier */}
          <div className="column is-4">
            <div className="box">
              <h3 className="title is-4 has-text-centered">Free</h3>
              <p className="subtitle has-text-centered has-text-grey">免費版</p>
              <p className="title is-2 has-text-centered">$0</p>

              <div className="content">
                <ul>
                  <li>基本轉換功能</li>
                  <li>10MB 檔案大小限制</li>
                  <li>支援所有格式</li>
                </ul>
              </div>

              <button className="button is-fullwidth" disabled>
                目前方案
              </button>
            </div>
          </div>

          {/* Monthly Tier */}
          <div className="column is-4">
            <div className="box">
              <h3 className="title is-4 has-text-centered">Monthly</h3>
              <p className="subtitle has-text-centered has-text-grey">月訂閱</p>
              <p className="title is-2 has-text-centered">
                NT$99<span className="is-size-6">/月</span>
              </p>

              <div className="content">
                <ul>
                  <li>Free 方案所有功能</li>
                  <li>100MB 檔案大小限制</li>
                  <li>自訂字典對照</li>
                  <li>優先處理佇列</li>
                </ul>
              </div>

              <button className="button is-fullwidth" disabled>
                即將推出
              </button>
            </div>
          </div>

          {/* Lifetime Tier */}
          <div className="column is-4">
            <div className="box has-background-warning-light">
              <div className="has-text-centered mb-2">
                <span className="tag is-danger">限時優惠</span>
              </div>
              <h3 className="title is-4 has-text-centered">Lifetime</h3>
              <p className="subtitle has-text-centered has-text-grey">終身授權</p>
              <p className="title is-2 has-text-centered">
                <span className="has-text-grey-light" style={{ textDecoration: 'line-through' }}>
                  $899
                </span>
                {' '}
                $499
              </p>

              <div className="content">
                <ul>
                  <li>Monthly 方案所有功能</li>
                  <li>一次付費，永久使用</li>
                  <li>所有未來新功能</li>
                  <li>優先客戶支援</li>
                </ul>
              </div>

              <a
                href={gumroadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="button is-primary is-fullwidth"
              >
                立即購買 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Commit**

```bash
git add components/PricingSection.tsx
git commit -m "feat: add PricingSection component with 3-column layout"
```

---

## Task 11: Create Gumroad Webhook Handler

**Files:**
- Create: `app/api/webhooks/gumroad/route.ts`
- Create: `__tests__/api/webhooks/gumroad.test.ts`

**Step 1: Write the failing test**

Create `__tests__/api/webhooks/gumroad.test.ts`:
```typescript
/**
 * @jest-environment node
 */

import { POST } from '@/app/api/webhooks/gumroad/route';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: jest.fn().mockReturnValue({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: '123' }, error: null }),
        }),
      }),
    }),
  }),
}));

describe('Gumroad Webhook', () => {
  const validPayload = {
    seller_id: 'test-seller-id',
    product_id: 'test-product-id',
    email: 'buyer@example.com',
    sale_id: 'sale-123',
    sale_timestamp: '2024-01-01T00:00:00Z',
    price: 49900,
    is_recurring_charge: false,
    resource_name: 'sale',
  };

  beforeEach(() => {
    process.env.GUMROAD_SELLER_ID = 'test-seller-id';
    process.env.GUMROAD_LIFETIME_PRODUCT_ID = 'test-product-id';
  });

  it('returns 401 for invalid seller_id', async () => {
    const formData = new URLSearchParams({ ...validPayload, seller_id: 'wrong-id' });
    const request = new Request('http://localhost/api/webhooks/gumroad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 200 for valid webhook', async () => {
    const formData = new URLSearchParams(validPayload as any);
    const request = new Request('http://localhost/api/webhooks/gumroad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/api/webhooks/gumroad.test.ts`

Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

Create `app/api/webhooks/gumroad/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { GumroadWebhookPayload } from '@/types/user';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const payload: GumroadWebhookPayload = {
      seller_id: formData.get('seller_id') as string,
      product_id: formData.get('product_id') as string,
      product_name: formData.get('product_name') as string || '',
      email: formData.get('email') as string,
      sale_id: formData.get('sale_id') as string,
      sale_timestamp: formData.get('sale_timestamp') as string,
      price: parseInt(formData.get('price') as string || '0', 10),
      is_recurring_charge: formData.get('is_recurring_charge') === 'true',
      resource_name: formData.get('resource_name') as string,
    };

    // Verify seller_id matches
    if (payload.seller_id !== process.env.GUMROAD_SELLER_ID) {
      console.error('Invalid seller_id:', payload.seller_id);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine license type based on product
    const isLifetime = payload.product_id === process.env.GUMROAD_LIFETIME_PRODUCT_ID;
    const licenseType = isLifetime ? 'lifetime' : 'monthly';

    // Calculate expiry for monthly (30 days from now)
    const expiresAt = isLifetime
      ? null
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const supabase = createServiceClient();

    // Find existing profile by email or create new one
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', payload.email)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await supabase
        .from('profiles')
        .update({
          license_type: licenseType,
          license_expires_at: expiresAt,
          gumroad_purchase_id: payload.sale_id,
          gumroad_product_id: payload.product_id,
          purchased_at: payload.sale_timestamp,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id);

      if (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    } else {
      // Create profile for non-authenticated user (they'll link when they sign up)
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          email: payload.email,
          license_type: licenseType,
          license_expires_at: expiresAt,
          gumroad_purchase_id: payload.sale_id,
          gumroad_product_id: payload.product_id,
          purchased_at: payload.sale_timestamp,
        });

      if (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    }

    console.log(`Processed purchase for ${payload.email}: ${licenseType}`);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/api/webhooks/gumroad.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/webhooks/gumroad/route.ts __tests__/api/webhooks/gumroad.test.ts
git commit -m "feat: add Gumroad webhook handler"
```

---

## Task 12: Create Server Actions for Auth

**Files:**
- Create: `lib/actions/auth.ts`

**Step 1: Create server actions**

Create `lib/actions/auth.ts`:
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
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
```

**Step 2: Commit**

```bash
git add lib/actions/auth.ts
git commit -m "feat: add auth server actions"
```

---

## Task 13: Create Header Component

**Files:**
- Create: `components/Header.tsx`

**Step 1: Create component**

Create `components/Header.tsx`:
```typescript
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/user';
import AuthButton from './AuthButton';

interface HeaderProps {
  user: User | null;
  profile: Profile | null;
}

export default function Header({ user, profile }: HeaderProps) {
  return (
    <nav className="navbar" role="navigation" aria-label="main navigation">
      <div className="container">
        <div className="navbar-brand">
          <a className="navbar-item" href="/">
            <strong>txtconv</strong>
          </a>
        </div>

        <div className="navbar-end">
          <div className="navbar-item">
            <div className="buttons">
              <AuthButton user={user} profile={profile} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Commit**

```bash
git add components/Header.tsx
git commit -m "feat: add Header component with auth button"
```

---

## Task 14: Update Layout with Auth Provider

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Update layout**

Update `app/layout.tsx`:
```typescript
import type { Metadata } from "next";
import { GoogleTagManager } from '@next/third-parties/google';
import 'bulma/css/bulma.min.css';
import 'animate.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import "./globals.css";

export const metadata: Metadata = {
  title: "txtconv - 簡繁轉換工具",
  description: "將簡體中文文字檔案轉換為繁體中文",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <GoogleTagManager gtmId="GTM-TWV35322" />
      <body>{children}</body>
    </html>
  );
}
```

Note: Layout stays mostly the same - auth state is fetched per-page via server components.

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "docs: add note about auth in layout"
```

---

## Task 15: Update Main Page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update page**

Update `app/page.tsx`:
```typescript
import FileUpload from '@/components/FileUpload';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PricingSection from '@/components/PricingSection';
import { getAuthUser, getProfile } from '@/lib/actions/auth';

export default async function Home() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <div className="App">
      <Header user={user} profile={profile} />

      <section className="hero">
        <div className="hero-body">
          <div className="container">
            <h1 className="title has-text-left has-text-dark">
              小說字幕簡轉繁、純文字檔案簡體轉繁體
            </h1>
            <h2 className="subtitle has-text-left has-text-dark mt-2">
              線上免費將剪映 Capbut 字幕、小說、電子書、CSV 等文字檔從簡體轉換成繁體中文，支援批次轉換。
            </h2>
            <div className="has-text-dark">
              <p>支援檔案格式為：</p>
              <ul>
                <li>.txt 純文字小說檔案</li>
                <li>.srt 電影字幕檔案</li>
                <li>.csv 資料格式</li>
                <li>.xml 資料格式</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="dropzone-panel">
          <FileUpload />
        </div>
      </div>

      <PricingSection
        gumroadUrl={process.env.NEXT_PUBLIC_GUMROAD_URL || 'https://gumroad.com'}
      />

      <div className="container">
        <Footer />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: integrate auth and pricing into main page"
```

---

## Task 16: Setup Supabase Database (Manual)

**Files:**
- None (Supabase Dashboard)

**Step 1: Run SQL in Supabase**

Go to Supabase Dashboard → SQL Editor → Run:

```sql
-- Table: profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  license_type text not null default 'free'
    check (license_type in ('free', 'lifetime', 'monthly')),
  license_expires_at timestamptz,
  gumroad_purchase_id text,
  gumroad_product_id text,
  purchased_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, license_type)
  values (new.id, new.email, 'free')
  on conflict (email) do update set id = new.id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS policies
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Service role can do everything"
  on public.profiles for all
  using (true)
  with check (true);
```

**Step 2: Configure Auth in Supabase**

- Go to Authentication → URL Configuration
- Set Site URL: `https://your-domain.com` (or localhost:3000 for dev)
- Set Redirect URLs: `https://your-domain.com/auth/callback`

**Step 3: Document completion**

No git commit needed - this is external configuration.

---

## Task 17: Configure Gumroad Webhook (Manual)

**Files:**
- None (Gumroad Dashboard)

**Step 1: Set webhook URL**

Go to Gumroad → Settings → Advanced → Webhooks:
- Add webhook URL: `https://your-domain.com/api/webhooks/gumroad`
- Enable "Sale" events

**Step 2: Get IDs**

- Note your Seller ID from Settings
- Note your Product ID from product edit page
- Add these to `.env.local`

**Step 3: Document completion**

No git commit needed - this is external configuration.

---

## Task 18: Add Environment Variable for Gumroad URL

**Files:**
- Modify: `.env.example`

**Step 1: Add NEXT_PUBLIC_GUMROAD_URL**

Add to `.env.example`:
```bash
# Gumroad Product URL (public)
NEXT_PUBLIC_GUMROAD_URL=https://your-username.gumroad.com/l/product-id
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add public Gumroad URL env var"
```

---

## Task 19: Final Integration Test

**Files:**
- None (manual testing)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test login flow**

1. Click "Login" button
2. Enter email
3. Click "Send Magic Link"
4. Check email, click link
5. Verify redirect back to site
6. Verify email shown in dropdown

**Step 3: Test purchase flow (sandbox)**

1. Click "立即購買" on Lifetime tier
2. Complete Gumroad checkout (use test card if available)
3. Webhook should fire
4. Login with same email
5. Verify "Pro" badge appears

**Step 4: Commit final state**

```bash
git add -A
git commit -m "feat: complete purchase system MVP integration"
```

---

## Success Criteria Checklist

- [ ] User can log in with email magic link
- [ ] User can log out
- [ ] "立即購買" opens Gumroad checkout
- [ ] Gumroad webhook creates/updates profile on purchase
- [ ] Paid user sees "Pro" badge when logged in
- [ ] Pricing section displays 3 columns correctly
- [ ] Monthly column shows "即將推出" disabled state
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
