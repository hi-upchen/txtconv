-- supabase/migrations/20261020_ecpay_callback_failures.sql
-- One row per failed ECPay callback. The health page reads the newest row.
-- A failure younger than 24 hours keeps the callbacks check failing.
-- Only the production store writes rows. Signature failures are never recorded.
-- This repo has no Supabase CLI setup. The owner pastes this file into the
-- Supabase SQL editor by hand. Keep it idempotent.

create table if not exists public.ecpay_callback_failures (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  reason            text not null,                 -- 失敗原因，例如金額不符、找不到訂單
  merchant_trade_no text                           -- 對應的訂單編號；回呼沒帶訂單編號時為空
);

create index if not exists ecpay_callback_failures_created_at_idx
  on public.ecpay_callback_failures (created_at);

alter table public.ecpay_callback_failures enable row level security;
-- 不建任何 policy：只有 service role（會略過 RLS）讀寫這張表。
