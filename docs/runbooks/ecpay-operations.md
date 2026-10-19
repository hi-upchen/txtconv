# 綠界（ECPay）結帳維運手冊

本文件說明 txtconv Pro 終身版（NT$899）綠界付款上線後的日常操作：退款、對帳、上線前檢查。
所有查詢都在 Supabase 後台的 SQL 編輯器執行（專案 `pwlpiigsdlccrcqftiit`）。

## 名詞

- **訂單表 `ecpay_orders`**：每次按「前往綠界付款」就建一筆。狀態只有三種：
  - `pending`（待付款）：已送到綠界收銀台，還沒收到綠界的付款通知。
  - `paid`（已付款）：綠界伺服器通知付款成功，簽章、金額都核對過。
  - `refunded`（已退款）：owner 在綠界後台退刷後，手動標記。
- **帳號資料 `profiles`**：`license_type = 'lifetime'` 代表終身版；`'free'` 代表免費版。
- **付款通知**：綠界伺服器呼叫 `/api/payment/ecpay/callback`。這是唯一會把訂單改成已付款、並開通終身版的地方。

## 一、手動退款（14 天內不滿意可退款）

綠界退刷後**不會**通知本站，所以本站資料要手動更新，否則買家會保留終身版、訂單也會一直顯示已付款。

1. 綠界廠商後台 → 信用卡收單 → 找到該筆交易 → 退刷。記下綠界交易編號。
2. 在 SQL 編輯器找出訂單（用買家 email 或綠界交易編號）：

   ```sql
   select merchant_trade_no, user_id, email, amount_twd, status, paid_at, ecpay_trade_no
   from public.ecpay_orders
   where email = '買家的 email'      -- 或 ecpay_trade_no = '綠界交易編號'
   order by created_at desc;
   ```

3. 把訂單標成已退款，並把帳號改回免費版（同一個交易內執行）：

   ```sql
   begin;
   update public.ecpay_orders
     set status = 'refunded', refunded_at = now()
     where merchant_trade_no = 'TC開頭的訂單編號' and status = 'paid';
   update public.profiles
     set license_type = 'free', purchased_at = null, updated_at = now()
     where id = '上一步查到的 user_id';
   commit;
   ```

4. 回信告知買家已退款。

已退款的訂單若再收到綠界的付款通知（例如有人在綠界後台按「重送通知」），程式會回覆 `1|OK`、記一筆警告，**不會**重新開通。

## 二、對帳查詢（每週一次；上線後第 14、28 天一定要跑）

付款或開通出錯時，程式只會寫在 Vercel 的執行紀錄裡，而這些紀錄 1 小時（Hobby）到 1 天（Pro）就會消失。資料庫才是準的，所以用下面兩條查詢找問題。

**A. 付了錢、但帳號不是終身版**（開通失敗，綠界重送一天最多四次後就放棄）：

```sql
select o.merchant_trade_no, o.user_id, o.email, o.paid_at, p.license_type
from public.ecpay_orders o
left join public.profiles p on p.id = o.user_id
where o.status = 'paid'
  and coalesce(p.license_type, 'missing') <> 'lifetime';
```

有結果時：確認綠界後台該筆真的成功，再手動開通：

```sql
update public.profiles
  set license_type = 'lifetime', license_expires_at = null,
      purchased_at = (select paid_at from public.ecpay_orders where merchant_trade_no = 'TC…'),
      updated_at = now()
  where id = '該 user_id';
```

若 `profiles` 沒有這個 id（`license_type` 顯示 missing），先 insert 一列 `(id, email, license_type)`。

**B. 同一個人付了兩次**（開兩個分頁各付一次）：

```sql
select user_id, email, count(*) as paid_orders, array_agg(merchant_trade_no) as orders
from public.ecpay_orders
where status = 'paid'
group by user_id, email
having count(*) > 1;
```

有結果時：保留最早一筆，其他到綠界後台退刷，再照「一、手動退款」第 3 步只更新訂單狀態（**不要**把帳號改回免費版）。

## 三、合併上線前檢查

1. Vercel txtconv 專案的 **Production** 環境有這五個變數（只看名稱，不看值）：
   `ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV`、`NEXT_PUBLIC_APP_URL`。
   - 前四個的值與 jars-money 專案相同。
   - `ECPAY_ENV=production` **只設在 Production**，絕不設在 Preview（否則預覽站會收真錢、付款通知又送不進受保護的預覽網址）。
   - `NEXT_PUBLIC_APP_URL` 必須是 `https://txtconv.arpuli.com`（付款通知的網址由它組成；設錯會讓每一筆付款都無法開通）。
   - `ECPAY_SANDBOX_GRANT` 在任何 Vercel 環境都**不能**設。
2. 部署後驗證：
   - `curl -s -o /dev/null -w '%{http_code}' https://txtconv.arpuli.com/checkout` → 200。
   - 未登入 POST `/api/payment/ecpay/create` → 303，`Location` 的網域必須是 `txtconv.arpuli.com`。
   - 對 `/api/payment/ecpay/callback` POST 一筆亂簽的資料 → 回 `0|CheckMacValue verify failed`（不是 `0|internal error`，代表正式金鑰已載入）。
3. GTM 發佈 `purchase`（腳本 `scripts/gtm-add-events.ts`，先 `--dry-run`）。
4. owner 真刷一筆 NT$899：帳號變終身版 → GA4 即時報表看到 `purchase`（含 value、currency）→ 照「一、手動退款」退掉這一筆（第一次實際演練退款流程）。
5. Gumroad 後台把 Pro 商品下架（unpublish，不要刪除；舊客的退款通知仍會打進 webhook）。
