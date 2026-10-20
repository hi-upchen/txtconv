-- supabase/migrations/20260901_ecpay_orders.sql
-- One row per ECPay checkout attempt. Rows are accounting records.
-- They must outlive the account, so there is no foreign key to auth.users.
-- A refund is recorded by hand. Set status to 'refunded' and fill refunded_at.
-- The app never treats a refunded order as paid.
-- This repo has no Supabase CLI setup. The owner pastes this file into the
-- Supabase SQL editor by hand. Keep it idempotent.

create table if not exists public.ecpay_orders (
  id                uuid primary key default gen_random_uuid(),
  merchant_trade_no text not null unique,          -- 我們產生的 20 碼訂單編號，綠界的 MerchantTradeNo
  user_id           uuid not null,                 -- 下單時登入者的 auth user id（= profiles.id）
  email             text not null,                 -- 下單時的 email，純紀錄
  amount_twd        integer not null,              -- 建單時伺服器寫入的價格（目前 899），回調比對這個值
  status            text not null default 'pending'
                      constraint ecpay_orders_status_check
                      check (status in ('pending', 'paid', 'refunded')),
  ecpay_trade_no    text,                          -- 綠界交易編號 TradeNo
  payment_type      text,                          -- 綠界 PaymentType，例如 Credit_CreditCard
  payment_date      timestamptz,                   -- 綠界 PaymentDate（台北時間，存成帶時區）
  rtn_code          integer,
  rtn_msg           text,
  simulate_paid     boolean not null default false,
  raw_callback      jsonb,                         -- 最後一次回調的完整內容，對帳用
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  refunded_at       timestamptz                    -- 退款時間，由 owner 退款後手動填入
);

create index if not exists ecpay_orders_user_id_idx on public.ecpay_orders (user_id);

alter table public.ecpay_orders enable row level security;
-- 不建任何 policy：只有 service role（會略過 RLS）讀寫這張表。
