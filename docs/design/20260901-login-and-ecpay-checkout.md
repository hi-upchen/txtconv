# 登入摩擦修正與綠界（ECPay）結帳 — 設計文件

- 日期：2026-09-01
- 狀態：已由 owner 核准（2026-09-01，五項決定全部採用建議）
- 出貨方式：兩個獨立的 PR，登入批次先、綠界批次後
- 相關文件：`docs/design/20260528-end-early-bird-pricing.md`（上一次定價變更）

## 0. 一句話

把「付費那一刻才需要的登入」從會失效的 Magic Link 改成 Google 一鍵登入加 Email 六位數驗證碼，然後把付款從 Gumroad（美金 30 元、英文結帳頁）換成綠界 ECPay（新台幣 899 元、中文信用卡收銀台），並且第一次能在站內量到真實成交。

## 1. 背景與問題

### 1.1 付款

- 現況：Pro 終身版透過 Gumroad 販售，價格 US$30，結帳頁是英文、幣別是美金。買家全部在台灣（狀態檔紀錄：15 筆銷售全 Taiwan）。
- 量到的漏點：付費牆彈窗出現後只有 0.82% 的人點「購買」（基線 0.36%，目標 1.5% 未達）。Gumroad 結帳頁到成交約 22%。
- 判斷：漏在「看到 US$30 這個外幣價格、要去英文網站」這一步。改成新台幣顯價與中文收銀台，直接作用在這一步。手續費（Gumroad 約 13%，綠界信用卡約 2–3%）只是順帶好處，不是動機。

### 1.2 登入

- 現況：唯一登入方式是 Supabase Magic Link（輸入 email，收信後點連結）。免費使用不需登入；登入只發生在付費綁定與自訂字典兩個場景。
- 量到的漏點（GA4，2026-06-01 至 08-31）：「登入連結已失效」頁 `/auth/auth-code-error` 有 52 個工作階段，7 月起翻倍；手機只佔全站 7% 流量，卻佔 73% 的登入失敗。粗估三成的寄信登入至少撞牆一次（代理指標推估，量級可信、幅度不精確）。
- 成因（Supabase 官方文件）：(a) PKCE 流程要求在同一個瀏覽器完成，手機在郵件 App 內建瀏覽器點連結就失敗；(b) 信箱安全掃描器會先點掉連結，連結因此立即失效。Supabase 自己的建議是改用六位數驗證碼。
- 為什麼要先修：綠界「先登入再買」會把登入變成付費的必經關卡。登入不先修，綠界帶來的轉換改善會被登入失敗吃掉。

## 2. 決策紀錄（owner 已拍板）

| 決定 | 內容 |
|---|---|
| 金流 | 全面改為綠界 ECPay，一次性信用卡付款 |
| 價格 | 新台幣 899 元，終身授權 |
| 綁定方式 | 先登入再買（訂單直接綁登入者的帳號 id，不再靠 email 比對） |
| 登入 | 留在 Supabase；加 Google 登入當主按鈕；Magic Link 改為 Email 六位數驗證碼；補登入事件；LINE 暫緩、Apple 不做、不換供應商 |
| 順序 | 登入批次先上線，綠界批次隨後（不需等兩週，幾天無錯誤即可） |
| 方案卡 | 移除從未開賣的「$3 USD/月 即將推出」卡片 |
| Gumroad | 綠界上線驗證通過後下架 Pro 商品；webhook 程式與資料表保留（舊客的退款／爭議通知仍會打進來）；Footer 捐款連結不動 |
| 生產驗證 | 綠界上線後由 owner 真刷一筆 NT$899，確認升級後到綠界後台退刷 |
| 退款文案 | 彈窗與結帳頁加一行「購買後 14 天內不滿意可退款」（服務條款本來就是 14 天） |

## 3. 範圍

### 3.1 這次做

- 第一批（PR 1，branch `feat/login-google-otp`）：Google 登入、Email 六位數驗證碼、登入後回到原頁、登入事件與 GA4 維度。
- 第二批（PR 2，branch `feat/ecpay-checkout`）：`/checkout` 結帳頁、綠界建單／回調／結果三支 API、`ecpay_orders` 資料表、完成頁與 `purchase` 事件、所有價格與文案改為 NT$899、移除月費卡、條款與隱私權更新、測試更新。

### 3.2 這次不做

- 電子發票（目前為綠界個人會員、月銷售額遠低於營業登記門檻；規模上來再議）。
- ATM、超商代碼、LINE Pay、Apple Pay（先只收信用卡；之後把 `ChoosePayment` 改成 `ALL` 就能一次開放，但非即時付款方式需要另外處理「付款晚到」的體驗）。
- 月費方案、LINE 登入、Apple 登入、更換認證供應商。
- 首頁 title／description（正在跑搜尋點閱率實驗，2026-09-14 讀數，不能動）。

## 4. 第一批：登入

### 4.1 使用者流程

1. 使用者按 Header 的「Login」，或在 `/checkout` 頁被要求登入。
2. 登入面板顯示：
   - 主按鈕「使用 Google 登入」。
   - 下方 email 欄位與「寄送驗證碼」按鈕。
3. Google 路徑：同分頁跳到 Google 選帳號 → 回到 `/auth/callback` → 伺服器交換 session、確保 profile 存在 → 導回原本的頁面。
4. 驗證碼路徑：送出 email → 面板切換成「輸入 6 位數驗證碼」（顯示寄到哪個信箱、60 秒後可重寄）→ 輸入正確 → 瀏覽器端完成驗證 → 整頁重新載入到原本的頁面。信件裡同時保留舊的連結，習慣點連結的人照舊可用。
5. 失敗：驗證碼錯誤或過期 → 面板顯示錯誤、可重寄；Google 被拒（例如在 LINE／Threads 內建瀏覽器被 Google 擋）→ 顯示「請改用 Email 驗證碼」。

### 4.2 程式變動

- 新元件 `components/LoginPanel.tsx`（client）：把現在 `AuthButton.tsx` 裡的登入表單抽出來，加 Google 按鈕與驗證碼輸入。`AuthButton` 的登入視窗與第二批的 `/checkout` 頁共用它。
  - Google：`supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${base}/auth/callback` } })`。
  - 寄碼：`supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${base}/auth/callback` } })`（同一支 API 既寄連結也寄驗證碼，信件內容由後台範本決定）。
  - 驗碼：`supabase.auth.verifyOtp({ email, token, type: 'email' })`。
  - 成功後：`window.location.assign(returnTo)`，整頁重載讓伺服器端元件看到新 session。
- `app/auth/callback/route.ts`、`app/auth/confirm/route.ts`：回跳目的地改為「查詢參數 `next` → 回原頁 cookie → `/`」三段式；成功後清掉 cookie；並寫入一個一次性 cookie 讓前端知道「剛剛登入成功、用的是哪種方式」（見 4.4）。
- `app/auth/auth-code-error/page.tsx`：加「改用驗證碼登入」的入口與 `login_failed` 事件。
- `lib/analytics.ts`、`types/gtm.d.ts`：三個新事件型別與 track 函式。

### 4.3 回到原本頁面的機制

- Cookie 名稱 `login_return_to`，值是站內路徑（必須以單一 `/` 開頭，拒絕 `//` 與含協定的值），`Max-Age=600`、`SameSite=Lax`、`Path=/`。
- 由前端在啟動任一種登入前寫入（值為當前路徑，或呼叫端指定的 `returnTo`，例如 `/checkout`）。
- 伺服器回跳路由讀取後導向並清除；驗證碼路徑在瀏覽器端自行讀取後導向並清除。
- 為什麼用 cookie 而不是在回跳網址加 `?next=`：Supabase 的回跳網址白名單文件沒有寫清楚查詢參數怎麼比對，cookie 不依賴這件事。既有的 `next` 參數支援保留，作為第一優先。

### 4.4 事件與量測

| 事件 | 觸發時機 | 參數 |
|---|---|---|
| `login_started` | 按下 Google 按鈕、或送出 email 寄碼 | `method`（`google` / `email_code`）、`source_path` |
| `login_succeeded` | 驗證碼路徑：`verifyOtp` 成功當下；Google／連結路徑：回跳後首個頁面讀到一次性 cookie `login_just_succeeded=<method>` 時送出並清除 | `method`（`google` / `email_code` / `magic_link`）、`source_path` |
| `login_failed` | `verifyOtp` 回錯誤、`signInWithOAuth` 回錯誤、或 `/auth/auth-code-error` 頁載入 | `method`、`reason` |

- GA4 新增事件範圍自訂維度 `login_method`（做法與 2026-07-30 登記 `reject_reason` 等維度相同：Admin API 加服務帳號 token）。
- GTM：站上的容器 `GTM-5C6MXCL4` 用**一個** GA4 事件 tag 轉送固定清單裡的 dataLayer 事件（目前是 `file_conversion_started/completed/failed`、`file_rejected`、`upgrade_cta_clicked`、`begin_checkout`，並映射 15 個參數）。三個登入事件（以及第二批的 `purchase`）必須加進這份清單並映射 `method`、`reason`、`transaction_id`、`currency` 等新參數，然後發佈新版容器。做法：用 GTM API（帳號 `6364290968`、容器 `257354615`）加服務帳號 token 讀出現有的事件 tag 與觸發器、擴充清單與參數映射、建立並發佈新版本（2026-07-04 用過同樣的做法，當時的腳本已不在 repo 裡，需要重寫一支小工具放在 `scripts/`，寫成冪等）；服務帳號沒有容器權限時，把要加的事件與參數清單交給 owner 在 GTM 後台操作。事件沒進清單就不會到 GA4，量測預登記會落空，所以這是合併前的必要步驟，不是加分項。

### 4.5 owner 要做的後台設定（約 30–60 分鐘，PR 1 合併前完成）

1. Google Cloud Console（建議放在 `ups-side-projects` 專案）→ APIs & Services → OAuth consent screen：User type 選 External；App name `txtconv`；支援信箱與開發者信箱填自己的；Authorized domains 加 `arpuli.com` 與 `supabase.co`；範圍維持預設（email、profile、openid）；**發佈到 Production**（停在 Testing 會有 100 位測試者上限與 7 天授權到期）。只用基本範圍不需要 Google 審查，使用者不會看到「未驗證應用程式」警告。
2. 同一處 → Credentials → Create credentials → OAuth client ID → Web application；Authorized redirect URIs 填 Supabase 後台 Providers → Google 頁面上顯示的「Callback URL (for OAuth)」（格式 `https://<專案代號>.supabase.co/auth/v1/callback`，直接從那裡複製）；記下 Client ID 與 Client secret。
3. Supabase 後台 → Authentication → Providers → Google：啟用，貼上 Client ID 與 Secret。
4. Supabase 後台 → Authentication → URL Configuration：Site URL 為 `https://txtconv.arpuli.com`；Redirect URLs 需包含 `https://txtconv.arpuli.com/**` 與 `http://localhost:3000/**`（若要在 Vercel 預覽環境測，再加 `https://*-upchens-projects.vercel.app/**`）。
5. Supabase 後台 → Authentication → Email Templates → Magic Link：在信件內容加入驗證碼，連結保留。建議內容：

   ```html
   <h2>登入 txtconv</h2>
   <p>你的驗證碼是：</p>
   <p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
   <p>請回到剛才的頁面輸入。驗證碼 1 小時內有效。</p>
   <p>或直接點這個連結登入：<a href="{{ .ConfirmationURL }}">登入</a></p>
   ```

6. 順手確認：Authentication → Rate Limits 的 email 發送上限，以及是否有設定自訂 SMTP（現行 Magic Link 已在用同一條路，正常運作即可不動）。

### 4.6 錯誤處理

- Google 回錯誤或使用者取消：面板顯示可讀的訊息並保留 email 路徑。
- 驗證碼錯誤／過期：顯示「驗證碼錯誤或已過期」，允許重寄（60 秒冷卻，對應 Supabase 一分鐘一封的限制）。
- `login_return_to` 值不合法：一律回 `/`。
- 回跳路由任何失敗：維持現行行為，導向 `/auth/auth-code-error`。

### 4.7 測試

- jest：`LoginPanel` 三條路徑各自呼叫正確的 Supabase 方法與參數、錯誤訊息、事件推送；回跳路由的三段式目的地與 cookie 清除；`login_return_to` 值驗證。
- Playwright：登入視窗出現 Google 按鈕與 email 欄位；攔截 Supabase 的 `/auth/v1/otp` 回 200 後面板切到驗證碼步驟；攔截 `/auth/v1/verify` 回錯誤時顯示錯誤訊息；既有 dev test-login 流程不受影響。
- 真人驗證（owner，後台設定完成後）：在生產環境用 Google 登入一次、用驗證碼登入一次，兩者都應回到原本頁面。執行代理無法收 owner 的信、也不該用 owner 的 Google 帳號，這一步只能由 owner 做。

### 4.8 上線順序

PR 1 開出 → CI 綠 → owner 完成 4.5 的六步 → 合併 → 生產驗證 → 幾天內觀察 `login_failed` 與 `/auth/auth-code-error` 無異常 → 進入第二批合併。

## 5. 第二批：綠界結帳

### 5.1 使用者流程

1. 三個購買入口（超限彈窗、方案卡、字典超量連結）都改成站內連結 `/checkout`，同分頁開啟。
2. `/checkout`（伺服器端頁面）依狀態顯示：
   - 未登入：說明「購買會綁定你的 email，請先登入」＋ `LoginPanel`（`returnTo="/checkout"`）。
   - 已登入、未付費：訂單摘要——Pro 終身版 NT$899、將綁定的 email、一行「購買後 14 天內不滿意可退款」、按鈕「前往綠界付款」（`<form method="post" action="/api/payment/ecpay/create">`）。
   - 已是終身版：導回首頁。
3. 建單 API 驗 session → 寫入 `pending` 訂單 → 回傳自動送出的表單頁 → 綠界信用卡收銀台。
4. 付款後同時發生兩件事：
   - 綠界伺服器 → 回調 API（**唯一授權點**）→ 訂單改為 `paid`、帳號改為終身版。
   - 使用者瀏覽器 → 綠界把結果 POST 到結果路由 → 303 到 `/checkout/complete?order=…`。
5. `/checkout/complete`：查登入者自己的該筆訂單。`paid` → 成功畫面、送一次 `purchase` 事件；`pending` → 「付款確認中」每 3 秒重整，超過 60 秒改顯示「若已扣款請來信」。

### 5.2 路由與頁面

| 路徑 | 方法 | 職責 |
|---|---|---|
| `/checkout` | GET | 上述三態頁面；同 Home 一樣呼叫 `ensureProfileLinked` |
| `/api/payment/ecpay/create` | POST | 驗 session（無 → 303 到 `/checkout`）；已終身版 → 303 到 `/`；建 `pending` 訂單；回傳自動送出到綠界的 HTML 表單（200） |
| `/api/payment/ecpay/callback` | POST | 綠界 `ReturnURL`。驗簽章 → `RtnCode` → 金額 → `SimulatePaid` → 原子改 `paid` → 授權 → 回 `1|OK` |
| `/api/payment/ecpay/result` | POST | 綠界 `OrderResultURL`（瀏覽器 POST）。驗簽章後 303 到 `/checkout/complete?order=<訂單編號>`；簽章不符 → 303 到 `/checkout/complete?error=1`。**不寫資料庫** |
| `/checkout/complete` | GET | 完成頁；`ClientBackURL` 也指向這裡 |

### 5.3 資料表

新增一張表，**不改 `profiles` 的欄位**。檔案放 `supabase/migrations/20260901_ecpay_orders.sql`（本 repo 沒有 Supabase CLI 設定，這個檔案是「紀錄用」，由 owner 貼到 Supabase SQL editor 執行）：

```sql
create table if not exists public.ecpay_orders (
  id                uuid primary key default gen_random_uuid(),
  merchant_trade_no text not null unique,          -- 我們產生的 20 碼訂單編號，綠界的 MerchantTradeNo
  user_id           uuid not null,                 -- 下單時登入者的 auth user id（= profiles.id）
  email             text not null,                 -- 下單時的 email，純紀錄
  amount_twd        integer not null,              -- 899
  status            text not null default 'pending' check (status in ('pending', 'paid')),
  ecpay_trade_no    text,                          -- 綠界交易編號 TradeNo
  payment_type      text,                          -- 綠界 PaymentType，例如 Credit_CreditCard
  payment_date      timestamptz,                   -- 綠界 PaymentDate（台北時間，存成帶時區）
  rtn_code          integer,
  rtn_msg           text,
  simulate_paid     boolean not null default false,
  raw_callback      jsonb,                         -- 最後一次回調的完整內容，對帳用
  created_at        timestamptz not null default now(),
  paid_at           timestamptz
);

create index if not exists ecpay_orders_user_id_idx on public.ecpay_orders (user_id);

alter table public.ecpay_orders enable row level security;
-- 不建任何 policy：只有 service role（會略過 RLS）讀寫這張表。
```

- 不對 `auth.users` 建外鍵：訂單是會計紀錄，必須比帳號活得久；帳號刪除不應連帶刪單，也不應被訂單擋住。
- 授權時只改 `profiles.license_type = 'lifetime'` 與 `purchased_at`；Gumroad 欄位留空。`isPaidUser` 與所有讀 `license_type` 的地方不用動。
- 原子轉態：`update … set status='paid', … where merchant_trade_no = ? and status = 'pending'` 回傳列數為 0 時，再查一次：已 `paid` → 視為重複回調（冪等，仍確保 profile 是終身版）；不存在 → `0|order not found`。

### 5.4 綠界參數與簽章

- 簽章純函數（`buildCheckMacValue`、`verifyCallback`）與官方範例向量測試從 jars-money 專案原樣搬入 `lib/payment/ecpay.ts`。
- 建單參數：`MerchantID`、`MerchantTradeNo`（`TC` + 18 碼加密亂數 base36，共 20 碼 = 綠界上限）、`MerchantTradeDate`（**用 `Intl.DateTimeFormat` 以 `Asia/Taipei` 產生** `yyyy/MM/dd HH:mm:ss`；Vercel 機器時鐘是 UTC，不能像 jars-money 那樣依賴機器時區）、`PaymentType=aio`、`TotalAmount=899`、`TradeDesc=txtconv Pro lifetime`、`ItemName=簡轉繁 Pro 終身版`、`ReturnURL`、`OrderResultURL`、`ClientBackURL`、`ChoosePayment=Credit`、`EncryptType=1`、`CustomField1=<user_id>`（對帳用，≤ 50 字元）。
- 端點：正式 `https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5`；測試 `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`。
- 設定（`lib/payment/config.ts`）：讀 `ECPAY_ENV`、`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`。`ECPAY_ENV=production` 才是正式站；其他值一律測試站，且測試站可用綠界公開的測試商店資料當預設值（`2000132` / `5294y06JbISpM5x9` / `v77hoKGq4kWxNNIS`，來源 https://developers.ecpay.com.tw/?p=22696）。
- 回調 URL 由 `NEXT_PUBLIC_APP_URL`（生產：`https://txtconv.arpuli.com`）組成；本機沙盒測試時以 ngrok 網址覆寫。

### 5.5 程式檔案

新增：
- `lib/payment/ecpay.ts`、`lib/payment/config.ts`、`lib/payment/orders.ts`（Supabase 讀寫與原子轉態）
- `app/api/payment/ecpay/create/route.ts`、`.../callback/route.ts`、`.../result/route.ts`
- `app/checkout/page.tsx`、`app/checkout/complete/page.tsx`（含一個小的 client 元件負責送 `purchase` 事件與 3 秒重整）
- `supabase/migrations/20260901_ecpay_orders.sql`
- 對應測試

修改：
- `components/PaywallDialog.tsx`：prop `gumroadUrl` 改為 `checkoutHref`（預設 `/checkout`）；按鈕改為站內連結、去掉 `target=_blank`；文案改 NT$899；加退款一行。
- `components/PricingSection.tsx`：移除 Monthly 卡（grid 改兩欄）；Lifetime 顯示 `NT$899`；「Monthly 方案所有功能」這條改成具體權益；按鈕連到 `/checkout`。
- `components/FileUpload.tsx`：刪 `GUMROAD_URL` 常數，改傳 `checkoutHref`。
- `components/CustomDictEditor.tsx`：升級連結改 `/checkout`。
- `app/page.tsx`：JSON-LD `offers` 改為 TWD 0 / TWD 899；`PricingSection` 不再傳 Gumroad 網址。
- `app/terms/page.tsx`「付款與退款」：改為透過綠界科技（ECPay）以信用卡付款；14 天內來信退款，由我們透過綠界退刷。
- `app/privacy/page.tsx`「付款資料」：付款由綠界處理，本站不接觸卡號；只保存訂單編號、綠界交易編號、金額、付款時間與付款狀態。
- `lib/analytics.ts`、`types/gtm.d.ts`：`begin_checkout` 改為 value 899、currency TWD；新增 `purchase`（`transaction_id`、`value`、`currency`、`items`）。
- `.env.example`：加四個 `ECPAY_*`；`NEXT_PUBLIC_GUMROAD_URL` 標註已不再用於購買。
- `e2e/purchase-flow.spec.ts`、`e2e/tiered-limits.spec.ts`：斷言改為 NT$899 與 `/checkout`。

保留不動：`app/api/webhooks/gumroad/route.ts`、`gumroad_sales` 表、`GUMROAD_SELLER_ID`／`GUMROAD_LIFETIME_PRODUCT_ID`、Footer 捐款連結。

### 5.6 錯誤處理與安全

- **正式站失敗關閉**：`VERCEL_ENV === 'production'` 而 `ECPAY_ENV !== 'production'`，或正式站缺任何一把金鑰 → 建單 API 回 503 與「付款暫時無法使用，請稍後再試」頁面。絕不把真客人送進測試收銀台。
- 回調永遠回 HTTP 200：成功 `1|OK`；失敗 `0|<原因>`。綠界收到非 `1|OK` 會每 5–15 分鐘重送、一天最多四次；回 500 只會製造重試風暴。
- 回調的檢查順序：`CheckMacValue` 簽章 → `RtnCode === 1` → `TradeAmt` 同時等於訂單金額與常數 899 → `SimulatePaid === 1` 時記 log、回 `1|OK`、**不授權**（綠界後台的「模擬付款」不會撥款）→ 原子改 `paid` → 授權 → 授權失敗回 `0|grant failed` 讓綠界重送（下一次會走「已 paid 但 profile 仍是 free」的補授權路徑）。
- 所有失敗都寫 log 含訂單編號與原因；`raw_callback` 存最後一次回調內容。
- 結果路由（瀏覽器那條）只驗簽章、只做轉址，永遠不寫資料庫、不授權。
- `/checkout/complete` 只查「登入者自己的」訂單（`merchant_trade_no` 與 `user_id` 同時吻合），拿別人的訂單編號看不到任何東西。
- 建單 API 不接受任何客戶端輸入決定金額或品名。

### 5.7 測試

- 單元：官方 CheckMacValue 範例逐位元組吻合；`config` 的失敗關閉守衛（正式站缺設定要丟錯、測試站用預設值）；台北時區日期格式；訂單編號長度與字元集；回調決策樹（簽章錯、`RtnCode` 非 1、金額不符、`SimulatePaid`、重複回調、找不到訂單、授權失敗要求重送）；結果路由簽章錯的轉址。
- Playwright：三個購買入口的 `href` 都是 `/checkout`、沒有 `target=_blank`；未登入的 `/checkout` 顯示登入面板；dev test-login 後 `/checkout` 顯示 NT$899 摘要與「前往綠界付款」；全站 HTML 不再有 Gumroad 購買連結；首頁 JSON-LD 幣別為 TWD；付費牆彈窗點購買送出 `begin_checkout` value 899 currency TWD。
- **沙盒端對端（由執行代理完成，不需 owner）**：
  1. 本機 `npm run dev` 搭 ngrok 取得公網 https 網址，以 `NEXT_PUBLIC_APP_URL=<ngrok>` 啟動。
  2. 用 Supabase 服務金鑰透過 Admin API 建一個專用測試帳號（`auth.admin.createUser`，`email_confirm: true`）——這是真實的免費帳號，不是 dev mock。登入方式：`auth.admin.generateLink({ type: 'magiclink', email })` 回傳的 `properties.hashed_token`，拿去開本站既有的 `/auth/confirm?token_hash=<hashed_token>&type=magiclink&next=/checkout`，該路由會用 `verifyOtp` 換成 session cookie（不要開 Supabase 回傳的 `action_link`，那條走的是把 token 放在網址片段的舊流程，和本站的 cookie session 不相容）。
  3. Playwright 以該帳號進 `/checkout` → 建單 → 綠界測試收銀台輸入測試卡 `4311-9522-2222-2222`（任意 3 碼安全碼、未來到期日；若有 3D 驗證，簡訊碼固定 `1234`）→ 回調經 ngrok 打進本機 → 斷言 `ecpay_orders` 該筆為 `paid`、`profiles` 為 `lifetime`、`/checkout/complete` 顯示成功並推送一次 `purchase`。
  4. 負路徑：對回調 API 送竄改簽章、竄改金額、`SimulatePaid=1`、重放同一筆——分別得到 `0|…`、`0|…`、`1|OK` 但不授權、`1|OK` 且不重複授權。
  5. 結束後刪除測試帳號與測試訂單。
- 生產驗證：合併部署後 curl `/checkout`（200、含登入面板）、`/api/payment/ecpay/create` 未登入 POST → 303；owner 真刷一筆 NT$899 → 帳號變終身版、`purchase` 事件進 GA4 → owner 到綠界後台退刷。

### 5.8 owner 要做的事

1. **合併前、且在執行代理跑沙盒端對端之前**：把 `supabase/migrations/20260901_ecpay_orders.sql` 貼進 Supabase 後台 SQL editor 執行（純新增，對現有功能零影響）。
2. **合併前**：在 Vercel 的 txtconv 專案加四個 Production 環境變數，值與 jars-money 專案相同：`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV=production`。可在 repo 根目錄執行 `vercel env add ECPAY_MERCHANT_ID production` 等四次（會提示輸入值），或在 Vercel 後台操作。Preview 環境不要設 `ECPAY_ENV=production`（預覽環境應永遠走測試站）。
3. 上線驗證後：Gumroad 後台把 Pro 商品下架（unpublish），不要刪除。

### 5.9 上線順序與回滾

PR 2 開出 → CI 綠 → owner 執行 SQL → 執行代理跑沙盒端對端 → owner 加 Vercel 變數 → 主對話確認四個變數名稱存在（`vercel env ls`，只看名稱）→ 合併 → 生產 curl 驗證 → owner 真刷一筆並退刷 → Gumroad 下架 → 狀態檔登記與量測預登記。

回滾：`git revert` 該 PR 或用 Vercel 的 instant rollback 回到前一個部署；`ecpay_orders` 表保留不需要動。

## 6. 量測預登記

| 批次 | 指標 | 基線 | 目標 | 讀數日 |
|---|---|---|---|---|
| 登入 | 登入完成率 = `login_succeeded` ÷ `login_started` | 無（只有失敗頁 52 次／3 個月的代理） | ≥ 80% | 2026-09-14 看方向、2026-09-28 正式 |
| 登入 | Google 佔登入方式比例 | — | ≥ 50% | 同上 |
| 登入 | `/auth/auth-code-error` 每週工作階段 | 約 5–6 | ≤ 1 | 同上 |
| 綠界 | 彈窗→點購買 = `begin_checkout` ÷ `file_rejected` | 0.82%（2026-07-30 至 08-11） | ≥ 1.5% | 2026-09-28 |
| 綠界 | 結帳頁→成交 = `purchase` ÷ `begin_checkout` | Gumroad 時期約 22% | ≥ 22%（不輸 Gumroad） | 2026-09-28 |

護欄（兩批共用）：每日 `file_conversion_completed` 不掉；每週新帳號不低於 8（現況約 37／月）；首頁搜尋點閱率實驗不受影響（這兩批都不碰 metadata）。

## 7. 風險與已知限制

- Google 登入在 LINE／Threads 等 App 內建瀏覽器可能被 Google 拒絕（`disallowed_useragent`）——驗證碼路徑就是備援；事件會告訴我們比例。
- 綠界個人會員收海外卡的能力**未確認**；目前買家全在台灣，先接受。
- 名義賣家從 Gumroad 變成 owner 本人：退款改為手動在綠界後台操作；發票與稅務義務隨規模而來，見 3.2。
- 綠界回調有可能比使用者回到完成頁晚幾秒，完成頁的「確認中」狀態就是為此設計；超過 60 秒仍 `pending` 多半是回調被擋（例如 `NEXT_PUBLIC_APP_URL` 錯誤），要看 log。
- Supabase 內建郵件服務有發送速率上限；現行 Magic Link 已在同一條路上運作，但驗證碼上線後若登入量增加要留意 4.5 第 6 步。

## 8. 附錄：綠界官方約束速查（2026-09-01 查證）

| 項目 | 約束 | 來源 |
|---|---|---|
| 端點 | 測試 `payment-stage.ecpay.com.tw`、正式 `payment.ecpay.com.tw`，路徑 `/Cashier/AioCheckOut/V5` | https://developers.ecpay.com.tw/?p=2862 |
| `MerchantTradeNo` | 唯一、不可重用、英數字、最長 20 | 同上 |
| `MerchantTradeDate` | `yyyy/MM/dd HH:mm:ss` | 同上 |
| `TotalAmount` | 整數、僅新台幣 | 同上 |
| `ItemName` / `TradeDesc` | 400 / 200 字元；`TradeDesc` 勿含特殊字元 | 同上 |
| `ReturnURL` | 伺服器對伺服器 POST，須回 `1|OK` | 同上 |
| `OrderResultURL` | 瀏覽器端 POST 到商店前端 | 同上 |
| `ClientBackURL` | 純返回按鈕，不帶付款資料 | 同上 |
| `CustomField1–4` | 各 50 字元 | 同上 |
| `EncryptType` | 固定 `1`（SHA256） | 同上 |
| 回調欄位 | `MerchantTradeNo`、`RtnCode`、`RtnMsg`、`TradeNo`、`TradeAmt`、`PaymentDate`、`PaymentType`、`SimulatePaid`、`CustomField1–4`、`CheckMacValue` 等；`application/x-www-form-urlencoded` | https://developers.ecpay.com.tw/?p=2878 |
| 成功碼 | `RtnCode = 1` | 同上 |
| 未回 `1|OK` | 5–15 分鐘後重送，當天最多四次 | 同上 |
| `SimulatePaid = 1` | 模擬付款，綠界不撥款，不得出貨 | 同上 |
| 測試環境 | 回調網址必須是公網、只支援 80／443；測試卡 `4311-9522-2222-2222`；3D 驗證簡訊碼固定 `1234` | https://developers.ecpay.com.tw/?p=2856 |
| CheckMacValue 演算法 | 依鍵名排序 → `HashKey=…&…&HashIV=…` → .NET 風格 URL encode → 全小寫 → SHA256 → 全大寫 | https://developers.ecpay.com.tw/?p=2902 |
