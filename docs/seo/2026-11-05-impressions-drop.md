# Search impressions drop, 2026-10-21 to 2026-11-01

Date of check: 2026-11-05.

## Summary

The repo does not cause the drop. Every technical SEO check passes.
Clicks stayed flat while impressions fell, and impressions are already recovering.
The cause is most likely a Google-side change in how often the page is shown.

## Search Console numbers (daily, whole site)

- 2026-10-01 to 10-20: 1,300 to 3,500 impressions a day, about 2,300 on average.
- 2026-10-25: 505. 10-27: 540. 10-28: 401. These are the lowest days.
- 2026-11-02: 2,428. This is back to the early October level.
- Daily clicks stayed between 63 and 167 the whole time (10-25 to 11-01 average: 87).
- Average position stayed near 5 to 6. It was 4.4 to 5.3 on 10-27 to 11-01.

For the query 簡轉繁:

- 10-12 to 10-15: 433 to 632 impressions a day, position 4.8 to 6.6.
- 10-28: 2 impressions. 11-02: 453 impressions, position 4.6.

For the query 簡體轉繁體:

- 10-28: 4 impressions at position 11.8. 11-02: 150 impressions at position 6.1.

The week-over-week fall in the brief is real, but it is a trough, not a steady decline.
The weeks of 10-12 also held an unusual peak (10-14: 3,546 impressions).

## What I checked on the live site (https://txtconv.arpuli.com)

- Home page: HTTP 200. One canonical, `https://txtconv.arpuli.com`. Robots meta is `index, follow`.
- No `X-Robots-Tag` header on the home page.
- `/robots.txt`: 200. Allows `/`, blocks `/api/` and `/auth/`, lists the sitemap.
- `/sitemap.xml`: 200, 9 URLs, all on the `https://txtconv.arpuli.com` host.
- `http://` redirects with 308 to `https://`. `/srt/` redirects with 308 to `/srt`.
- `www.txtconv.arpuli.com` does not resolve. There is no www duplicate to index.
- `/index.html` and unknown paths return 404, not 200.
- `/articles`: 200 with its own canonical.
- Structured data: 4 JSON-LD blocks on the home page. No hreflang tags, and none are needed for one language.
- Rendered title: 簡轉繁線上工具｜免費簡體轉繁體，免安裝、不上傳｜txtconv.
- All page URLs in Search Console are the canonical ones. No duplicate URLs appear.

## What changed in the repo near the drop

- 10-15 login (#98), 10-19 Google button (#105), 10-20 ECPay checkout (#108) and Next.js 16.4 (#112).
- 10-27 article system (#114), 10-28 dependency fixes (#115).
- 11-03 title and description rewrite (#116), 11-05 paywall copy (#117).

The drop began on 10-21 to 10-25. The article system shipped on 10-27, after the first low days.
The title rewrite shipped on 11-03, after the recovery began. Neither can explain the start of the drop.
None of the changes touch canonical, robots, redirects or the sitemap in a harmful way.

## Likely cause

Position held while impressions fell by about 70 percent on all devices and countries.
That points to fewer searches or fewer result pages that showed the site, not a ranking penalty or an indexing fault.
Candidates, none of which the repo controls:

- A Google-side change to the result page, such as a test of new layouts or features.
- Seasonal change in search volume for 簡轉繁 terms.
- Reporting noise in Search Console (10-28 shows 2 impressions for the main query).

The recovery on 10-29 and 11-02, with no code fix, supports this reading.

## Outside the repo

- Google result page changes and search volume cannot be fixed in code.
- Search Console settings are out of scope.

## Follow-up

- Re-check daily impressions for 簡轉繁 on 2026-11-12. Expect 300 or more a day if the recovery holds.
- If impressions fall again with no position change, compare with Google Trends for the same terms.
