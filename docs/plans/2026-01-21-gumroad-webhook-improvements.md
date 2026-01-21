# Gumroad Webhook Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve webhook to validate product IDs and log all sales to a dedicated Supabase table.

**Architecture:** Webhook validates seller, checks if product matches configured Pro product (ignores others), upserts full payload to `gumroad_sales` table, then updates user profile for Pro status.

**Tech Stack:** Next.js API routes, Supabase, TypeScript

---

## Task 1: Create gumroad_sales Table in Supabase

**Files:**
- Manual: Supabase Dashboard SQL Editor

**Step 1: Run SQL in Supabase Dashboard**

Go to Supabase Dashboard → SQL Editor → New Query → Paste and run:

```sql
create table public.gumroad_sales (
  id uuid primary key default gen_random_uuid(),

  -- Core identifiers
  seller_id text not null,
  product_id text not null,
  sale_id text not null unique,
  order_number text,
  purchaser_id text,

  -- Product info
  product_name text,
  permalink text,
  product_permalink text,
  short_product_id text,

  -- Buyer info
  email text not null,
  ip_country text,
  can_contact boolean,
  referrer text,

  -- Payment info
  price integer,
  gumroad_fee integer,
  currency text,
  quantity integer,
  variants text,

  -- Card info
  card_visual text,
  card_type text,
  card_bin text,
  card_expiry_month text,
  card_expiry_year text,

  -- Status flags
  discover_fee_charged boolean,
  is_gift_receiver_purchase boolean,
  refunded boolean,
  disputed boolean,
  dispute_won boolean,
  test boolean,

  -- Timestamps
  sale_timestamp timestamptz,
  created_at timestamptz default now()
);

-- Index for email lookups
create index idx_gumroad_sales_email on public.gumroad_sales(email);

-- RLS policy
alter table public.gumroad_sales enable row level security;

create policy "Service role can manage all sales"
  on public.gumroad_sales for all
  using (auth.role() = 'service_role');
```

**Step 2: Verify table created**

Run: `select * from gumroad_sales limit 1;`
Expected: Empty result set (no errors)

---

## Task 2: Update GumroadWebhookPayload Type

**Files:**
- Modify: `types/user.ts:15-30`

**Step 1: Replace GumroadWebhookPayload interface**

Replace the existing `GumroadWebhookPayload` interface with:

```typescript
export interface GumroadWebhookPayload {
  // Core identifiers
  seller_id: string;
  product_id: string;
  sale_id: string;
  order_number: string;
  purchaser_id: string;

  // Product info
  product_name: string;
  permalink: string;
  product_permalink: string;
  short_product_id: string;

  // Buyer info
  email: string;
  ip_country: string;
  can_contact: boolean;
  referrer: string;

  // Payment info
  price: number;
  gumroad_fee: number;
  currency: string;
  quantity: number;
  variants: string;

  // Card info
  card_visual: string;
  card_type: string;
  card_bin: string;
  card_expiry_month: string;
  card_expiry_year: string;

  // Status flags
  discover_fee_charged: boolean;
  is_gift_receiver_purchase: boolean;
  refunded: boolean;
  disputed: boolean;
  dispute_won: boolean;
  test: boolean;

  // Timestamps
  sale_timestamp: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

**Step 3: Commit**

```bash
git add types/user.ts
git commit -m "feat: expand GumroadWebhookPayload type with all fields"
```

---

## Task 3: Add GumroadSale Type

**Files:**
- Modify: `types/user.ts` (append after GumroadWebhookPayload)

**Step 1: Add GumroadSale interface**

Append to `types/user.ts`:

```typescript
export interface GumroadSale extends GumroadWebhookPayload {
  id: string;
  created_at: string;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add types/user.ts
git commit -m "feat: add GumroadSale type for database records"
```

---

## Task 4: Update Webhook Handler - Parse All Fields

**Files:**
- Modify: `app/api/webhooks/gumroad/route.ts:56-66`

**Step 1: Update payload parsing**

Replace the payload parsing block with:

```typescript
function parseBoolean(value: string | null): boolean {
  return value === 'true';
}

function parseNumber(value: string | null): number {
  return parseInt(value || '0', 10);
}

const payload: GumroadWebhookPayload = {
  // Core identifiers
  seller_id: formData.get('seller_id') as string,
  product_id: formData.get('product_id') as string,
  sale_id: formData.get('sale_id') as string,
  order_number: formData.get('order_number') as string || '',
  purchaser_id: formData.get('purchaser_id') as string || '',

  // Product info
  product_name: formData.get('product_name') as string || '',
  permalink: formData.get('permalink') as string || '',
  product_permalink: formData.get('product_permalink') as string || '',
  short_product_id: formData.get('short_product_id') as string || '',

  // Buyer info
  email: formData.get('email') as string,
  ip_country: formData.get('ip_country') as string || '',
  can_contact: parseBoolean(formData.get('can_contact') as string),
  referrer: formData.get('referrer') as string || '',

  // Payment info
  price: parseNumber(formData.get('price') as string),
  gumroad_fee: parseNumber(formData.get('gumroad_fee') as string),
  currency: formData.get('currency') as string || '',
  quantity: parseNumber(formData.get('quantity') as string),
  variants: formData.get('variants[]') as string || '',

  // Card info
  card_visual: formData.get('card[visual]') as string || '',
  card_type: formData.get('card[type]') as string || '',
  card_bin: formData.get('card[bin]') as string || '',
  card_expiry_month: formData.get('card[expiry_month]') as string || '',
  card_expiry_year: formData.get('card[expiry_year]') as string || '',

  // Status flags
  discover_fee_charged: parseBoolean(formData.get('discover_fee_charged') as string),
  is_gift_receiver_purchase: parseBoolean(formData.get('is_gift_receiver_purchase') as string),
  refunded: parseBoolean(formData.get('refunded') as string),
  disputed: parseBoolean(formData.get('disputed') as string),
  dispute_won: parseBoolean(formData.get('dispute_won') as string),
  test: parseBoolean(formData.get('test') as string),

  // Timestamps
  sale_timestamp: formData.get('sale_timestamp') as string,
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/webhooks/gumroad/route.ts
git commit -m "feat: parse all Gumroad webhook fields"
```

---

## Task 5: Update Webhook Handler - Product Validation

**Files:**
- Modify: `app/api/webhooks/gumroad/route.ts:68-76`

**Step 1: Add product validation after seller validation**

After the seller_id check, add product_id check:

```typescript
// Verify seller_id matches
if (payload.seller_id !== process.env.GUMROAD_SELLER_ID) {
  console.error('Invalid seller_id:', payload.seller_id);
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Check if this is the configured Pro product
const isConfiguredProduct = payload.product_id === process.env.GUMROAD_LIFETIME_PRODUCT_ID;
if (!isConfiguredProduct) {
  console.log(`Ignoring non-Pro product: ${payload.product_id} (${payload.product_name})`);
  return NextResponse.json({ success: true, ignored: true }, { status: 200 });
}
```

**Step 2: Remove the old licenseType logic**

Remove this block (it will be simplified):
```typescript
// Determine license type based on product
const isLifetime = payload.product_id === process.env.GUMROAD_LIFETIME_PRODUCT_ID;
const licenseType = isLifetime ? 'lifetime' : 'monthly';
```

Replace with:
```typescript
// This is a lifetime Pro purchase
const licenseType = 'lifetime';
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/api/webhooks/gumroad/route.ts
git commit -m "feat: add product validation, ignore non-Pro products"
```

---

## Task 6: Update Webhook Handler - Upsert to gumroad_sales

**Files:**
- Modify: `app/api/webhooks/gumroad/route.ts` (before profile update logic)

**Step 1: Add upsert to gumroad_sales table**

After product validation, before profile update, add:

```typescript
// Upsert sale record to gumroad_sales table
const { error: saleError } = await supabase
  .from('gumroad_sales')
  .upsert(
    {
      seller_id: payload.seller_id,
      product_id: payload.product_id,
      sale_id: payload.sale_id,
      order_number: payload.order_number,
      purchaser_id: payload.purchaser_id,
      product_name: payload.product_name,
      permalink: payload.permalink,
      product_permalink: payload.product_permalink,
      short_product_id: payload.short_product_id,
      email: payload.email,
      ip_country: payload.ip_country,
      can_contact: payload.can_contact,
      referrer: payload.referrer,
      price: payload.price,
      gumroad_fee: payload.gumroad_fee,
      currency: payload.currency,
      quantity: payload.quantity,
      variants: payload.variants,
      card_visual: payload.card_visual,
      card_type: payload.card_type,
      card_bin: payload.card_bin,
      card_expiry_month: payload.card_expiry_month,
      card_expiry_year: payload.card_expiry_year,
      discover_fee_charged: payload.discover_fee_charged,
      is_gift_receiver_purchase: payload.is_gift_receiver_purchase,
      refunded: payload.refunded,
      disputed: payload.disputed,
      dispute_won: payload.dispute_won,
      test: payload.test,
      sale_timestamp: payload.sale_timestamp,
    },
    { onConflict: 'sale_id' }
  );

if (saleError) {
  console.error('Error upserting sale:', saleError);
  return NextResponse.json({ error: 'Database error' }, { status: 500 });
}

console.log(`Sale logged: ${payload.sale_id} for ${payload.email}`);
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/webhooks/gumroad/route.ts
git commit -m "feat: upsert sales to gumroad_sales table"
```

---

## Task 7: Update Webhook Handler - Simplify Profile Logic

**Files:**
- Modify: `app/api/webhooks/gumroad/route.ts:78-128`

**Step 1: Remove monthly expiry logic**

Since we only process lifetime purchases now, remove the expiry calculation:

```typescript
// Calculate expiry for monthly (30 days from now)
const expiresAt = isLifetime
  ? null
  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
```

Replace with:
```typescript
// Lifetime purchases don't expire
const expiresAt = null;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/webhooks/gumroad/route.ts
git commit -m "refactor: simplify profile update for lifetime-only"
```

---

## Task 8: Test Webhook with Gumroad Ping

**Files:**
- None (manual testing)

**Step 1: Ensure dev server is running**

Run: `npm run dev`

**Step 2: Ensure ngrok is running**

Run: `ngrok http 3000`
Copy the HTTPS URL.

**Step 3: Update Gumroad Ping URL**

Go to Gumroad Dashboard → Settings → Advanced → Ping
Set URL to: `https://<your-ngrok-url>/api/webhooks/gumroad`

**Step 4: Send test ping from Gumroad**

Click "Send" on the Ping test button.

**Step 5: Check terminal output**

Expected console output:
```
=== GUMROAD WEBHOOK RECEIVED ===
{ ... full payload ... }
================================
Ignoring non-Pro product: B3K7zHJBfTCgXhEWPJnJcQ== (捐助支持簡體轉繁體工具)
```

(It should ignore because test product != configured lifetime product)

**Step 6: Verify in Supabase**

Check `gumroad_sales` table - should be empty (product was ignored).

---

## Task 9: Final Commit and Cleanup

**Files:**
- All modified files

**Step 1: Remove debug logging (optional)**

Remove or reduce the verbose logging if desired.

**Step 2: Final commit**

```bash
git add .
git commit -m "feat: complete gumroad webhook improvements

- Validate product_id matches configured Pro product
- Ignore non-Pro products with console.log
- Upsert all sale fields to gumroad_sales table
- Simplify profile update for lifetime-only purchases"
```

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Create gumroad_sales table | Manual |
| 2 | Update GumroadWebhookPayload type | Code |
| 3 | Add GumroadSale type | Code |
| 4 | Parse all webhook fields | Code |
| 5 | Add product validation | Code |
| 6 | Upsert to gumroad_sales | Code |
| 7 | Simplify profile logic | Code |
| 8 | Test with Gumroad ping | Manual |
| 9 | Final commit | Code |
