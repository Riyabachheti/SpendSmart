# SpendSmart Analytics Dashboard

## Executive Summary

The dashboard replaces the original static insight area with live analytics from the `/analytics/summary`, `/analytics/trend`, and `/analytics/budget-status` contracts. It coordinates category spending, a zero-filled rolling trend, and budget-versus-actual progress through one shared month/year selection while retaining the recent-expenses list.

Each analytics panel owns its loading, empty, and error state. The category donut and trend line also include screen-reader-only data tables containing the same values as their visual charts.

## Decision Log

- Analytics lives in `src/features/analytics/`, following the existing API/types/query-key feature structure.
- One dashboard-owned period drives summary, budget status, and the ending month of the trend. Trend length remains an independent 3/6/12-month control.
- Decimal strings cross into numbers only at the chart/layout boundary. Visible money values always pass through `Intl.NumberFormat`.
- Category slices preserve backend order. Eight token-derived colors repeat by index; uncategorized spend uses `--muted-foreground`.
- The budget fill clamps to 0–100%. Overages remain visible in text, and `percent_used === null` has a separate non-percentage presentation.
- Recharts defaults were avoided for tooltips because their inline light styling does not fit both themes.

## Seed Data and Manual Verification

Clearly labeled development fixtures were added to the local `riya@example.com` account and known-login `test_user1@example.com` account. The latter was used for browser verification:

- June and July 2026 contain verified INR expenses across multiple categories.
- May 2026 is intentionally a zero-spend month.
- July 2026 contains an overall budget, an over-budget category, and a zero-amount category budget.
- July category total rendered as ₹2,550.50 for the known-login test account.
- The six-month trend rendered dense February–July points, including May at ₹0.00.
- Overall, over-budget, and null-percentage budget branches all rendered without `NaN` or overflow.
- The month selector updated summary, trend ending period, and budget status together.
- Accessible fallback tables exposed category amount/count and monthly amount/count data.
- A persisted header control now switches light/dark mode without a reload; both token sets were verified against populated charts at desktop and mobile widths.
- Unknown word-based category icon keys use a stable fallback, `briefcase` maps to Lucide, and custom emoji/glyphs remain supported.

## Automated Testing

- `npm run build` — passed with zero TypeScript errors.
- `npm run lint` — passed with zero warnings.
- `npm test` — 10 Vitest/Testing Library/MSW tests passed across icon fallbacks, theme persistence, loading/empty/error/retry states, budget edges, accessible tables/progress bars, and coordinated period/window controls.
- Route-level lazy loading split the former 777.61 kB main bundle into an app-shell chunk of approximately 387.86 kB / 124.84 kB gzip and a dashboard chunk of approximately 386.47 kB / 111.17 kB gzip. No production chunk exceeds Vite's 500 kB warning threshold.

## Known Simplifications and Follow-ups

- Budget status remains INR-only because the backend endpoint hardcodes INR.
- Positional chart colors can move when backend category ordering changes.
- More than eight categories repeat palette colors.
- `npm install recharts` reported two high-severity dependency audit findings. No breaking `npm audit fix --force` was applied; review these deliberately during dependency hardening.
