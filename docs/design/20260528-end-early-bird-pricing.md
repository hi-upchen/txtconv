# End Early-Bird Pricing — Transition to Official Lifetime Price

**Date:** 2026-05-28
**Status:** Approved, ready for implementation
**Owner:** Up Chen

## Why this exists

txtconv's Lifetime tier has been on sale as an "early-bird" discount ($15, struck through from $30) for an extended period — long enough that the "early-bird" framing no longer reflects reality. The aim of this change is twofold:

1. **Restore truthful pricing.** Bring Lifetime to its stated official price of $30, removing the strikethrough and "早鳥限定" framing.
2. **Honor early-bird buyers.** Existing $15 lifetime buyers should feel they actually got the early-bird advantage they were promised — confirmed via a personal thank-you email that explicitly acknowledges the price restoration.

A secondary goal: use the thank-you moment to gather low-volume, high-signal feedback from existing buyers, informing what to build next.

## Why not a bigger change

Two alternatives were considered and rejected for now:

- **Launch Monthly subscription alongside.** Estimated 1.5–3 days of work (new webhook event handling for subscription lifecycle, billing portal UI, expiration cron). Out of budget given the user's time constraints. The "即將推出" Monthly tier remains in place as future optionality.
- **Switch entirely to subscription, retire Lifetime sales.** Same work as above, plus higher retention risk: txtconv is a transactional tool (users convert files and leave), not the kind of repeat-engagement product that supports subscription retention.

Decision: ship the smallest change that delivers on the core motivation. Re-evaluate Monthly only after there is a recurring-use feature (cloud dictionary sync, batch automation, API access) that justifies a subscription pricing model.

## Scope

**In scope:**
- Update `components/PricingSection.tsx` Lifetime card: remove "早鳥限定" badge, remove $30 strikethrough, change displayed price from $15 to $30.
- Manual Gumroad dashboard update: change Lifetime product price from $15 to $30; update variant name accordingly.
- Send a thank-you + feedback survey email to existing lifetime buyers via Gumroad's "Email past buyers" feature.
- Create a 3-question Google Form (or equivalent) for the survey.

**Out of scope:**
- No changes to `app/api/webhooks/gumroad/route.ts`. The webhook accepts whatever price Gumroad sends and stores it on `gumroad_sales`; no business logic depends on the $15 vs. $30 value.
- No changes to the `profiles` or `gumroad_sales` schemas.
- No changes to `lib/auth.ts` or the `isPaidUser` logic.
- Existing lifetime customers are NOT touched — `license_type = 'lifetime'` remains permanent.
- The Monthly card remains in its current "即將推出" disabled state.
- No deadline, countdown, or "last chance" messaging — the price change is a quiet correction, not a sales event.

## UI changes

**File:** `components/PricingSection.tsx`, Lifetime card only.

Remove:
- The badge `<div className="absolute -top-3 ... bg-rose-400 ...">早鳥限定</div>`
- The strikethrough `<span className="text-2xl text-gray-400 line-through font-bold">$30</span>`

Change:
- The active price from `$15` to `$30`

Keep:
- The container's cream background (`bg-[#fffdf5]`) and amber border. Lifetime remains the visually featured tier — it is the only paid option live.
- The "立即購買" CTA wiring to the existing Gumroad URL (no Gumroad URL change is required).
- The "目前方案" button logic when the viewer already owns the lifetime license.

## Gumroad dashboard changes (manual, by Up)

These must happen in the dashboard since [Gumroad has no public API for product creation or price updates](https://github.com/antiwork/gumroad/issues/4019) as of 2026-05.

1. Edit product "捐助支持簡體轉繁體工具".
2. Change price from $15 to $30.
3. Update variant: rename `15 美金` → `30 美金` (or remove the variant entirely if no longer needed).
4. Save.
5. From an incognito window, click the homepage Lifetime CTA → verify Gumroad checkout shows $30.

## Rollout order

Order matters to avoid a brief window where homepage and Gumroad disagree:

1. **Deploy the website change first** (homepage shows $30). At this point Gumroad still charges $15 — anyone who clicks through gets a momentary "even better deal". Low-risk side of the inconsistency.
2. **Then update Gumroad** (within the same hour). Now homepage and Gumroad agree at $30.
3. **Then send the thank-you email** (same day or next day; on the day of the change is best for narrative coherence).

The reverse order (Gumroad first) would create a window where the homepage advertises $15 but Gumroad charges $30 — that's a complaint, not just an inconsistency.

## Existing-customer treatment

- No database changes. All existing `profiles` rows with `license_type = 'lifetime'` continue working unchanged.
- The thank-you email (see below) is the only customer-facing action.
- No refunds, no upgrades, no migration.

## Thank-you email + feedback survey

Sent via **Gumroad's built-in "Email past buyers" feature** — no custom mail integration needed.

### Email body (Up may adjust tone)

```
Subject: 謝謝你的早鳥支持 ❤️ 想聽你 30 秒的回饋

[姓名] 你好，

我是 txtconv 的開發者 Up。

寫這封信是想說兩件事：

第一，謝謝你當初用 $15 買了早鳥終身授權。
從今天起 txtconv 的正式價格回到 $30 — 你鎖到的真的是早鳥優惠。
這個工具到現在能繼續更新，是因為有像你這樣的支持者。

第二，正式版開賣，我想開始規劃接下來該蓋什麼。
3 個快問題、不到 30 秒，幫我做點功課：

👉 [連結到表單]

任何回覆我都會親自看，必要的話會直接回信跟你討論。

再次感謝。
Up
```

### Survey (Google Form or Tally — 3 questions, ≤30 seconds)

Designed per the Sean Ellis PMF survey methodology + Jobs-to-be-Done framework (cached as personal best-practices knowledge):

| # | Question (zh) | Type | Why this question |
|---|---|---|---|
| 1 | 如果 txtconv 從明天起不能用了，你會感覺？ | Single choice: 非常失望 / 有點失望 / 不會失望 / 我已經沒在用了 | Sean Ellis PMF test — the single highest-signal question. >40% "very disappointed" indicates PMF. |
| 2 | 你第一次用 txtconv 是想完成什麼任務？ | Open text, 1–2 sentences | Jobs-to-be-Done — surfaces the real use case (subtitles? teaching material? ebooks?) rather than abstract preferences. |
| 3 | 如果可以再多一個功能，你最希望是什麼？ | Open text | Roadmap signal — only interpretable in conjunction with Q2. |

Optional field: respondent's email (so Up can reply with follow-up questions).

### What this is NOT

- Not a Net Promoter Score (NPS) survey. NPS measures sentiment but doesn't surface actionable priorities at this scale.
- Not a feature-voting page (Canny, Featurebase). Volume is too low to justify dedicated infrastructure.
- Not automated. Up will read every response personally; quantitative aggregation only happens if response count exceeds ~30.

## Testing & verification

No new automated tests are required for the UI change (no existing snapshot or unit tests cover `PricingSection.tsx`'s pricing text). Manual verification checklist:

- [ ] `npm run dev` → homepage shows three cards: Free $0, Monthly $3 "即將推出", Lifetime $30 (no badge, no strikethrough).
- [ ] Click Lifetime "立即購買" → Gumroad checkout shows $30.
- [ ] Logged-in lifetime test account (`/api/dev/test-login`) → Lifetime card shows "目前方案" button; no purchase CTA.
- [ ] `npm test` passes.
- [ ] `npm run lint` clean.
- [ ] `npm run build` succeeds.
- [ ] Incognito sanity check after Gumroad price update: full purchase flow (don't submit) shows $30 end-to-end.

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Website and Gumroad show different prices for >1 hour | Low | Deploy in the order specified above; verify within minutes. |
| Existing lifetime user clicks "立即購買" and is confused | Very low | The card already shows "目前方案" (disabled button) when `licenseType === 'lifetime'` — no regression risk. |
| Survey response rate too low to be useful (<10 responses) | Medium | Acceptable. Even 5 responses with a Sean Ellis "very disappointed" rate gives directional signal; absence of responses is itself a signal. |
| Buyer interprets the email as "we're cutting off your lifetime access" | Low | Email body explicitly emphasizes "鎖到的真的是早鳥優惠" — reassurance is front-loaded. |

## Success criteria

This change is "done" when:

1. Production homepage Lifetime card shows $30 with no early-bird visual treatment.
2. Gumroad checkout for the Lifetime product shows $30.
3. The thank-you email has been sent via Gumroad to all past lifetime buyers.
4. The feedback survey form is live and linked from the email.
5. `npm test`, `npm run lint`, `npm run build` all pass.
