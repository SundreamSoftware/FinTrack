# Financial algorithms

## Money and dates

Amounts are signed integer minor units, never binary floating-point decimal amounts. Supported ISO currencies and minor-unit digits come from Intl. Parsing uses text splitting and BigInt before a safe-integer check. Aggregation uses BigInt internally and rejects unsafe totals. Ratios and statistical models may use floating point; all forecasted monetary outputs are explicitly rounded to safe integers.

Transaction dates are calendar dates (`YYYY-MM-DD`), not instants. CSV accepts ISO or day-first dates and checks actual calendar validity. Helpers use UTC noon for calendar arithmetic; today's date uses the browser's local timezone. Display constructs local-noon dates to avoid timezone-driven date shifts. Monthly payment dates clamp to the target month's last day.

## Duplicate detection

The stable fingerprint is a serialized tuple of account ID, date, signed amount, currency, normalized description and normalized counterparty. Normalization applies NFKD, accent folding, uppercase and whitespace collapse. A frequency map of existing fingerprints consumes one occurrence for each imported match.

- **DUPLICATE:** an existing fingerprint occurrence is available. Never selected.
- **POTENTIAL_DUPLICATE:** same account/date/amount/currency with different text, or another incoming identical occurrence without a remaining existing match. Unselected by default; users can include it.
- **NEW:** no exact or similar evidence. Selected by default.

This cannot infer intent from identical bank rows. Occurrence counts plus explicit review preserve legitimate identical payments while making exact reimport idempotent. No unique fingerprint constraint is used.

## Categorization

Rules match normalized merchant/description/counterparty text or signed integer amount thresholds scoped to currency. Lower numeric priority wins; equal priority resolves by stable rule ID. Merchant mappings follow explicit rules. Historical inference uses the latest manually assigned category for the same normalized merchant identity. Keywords run last. Unmatched transactions remain uncategorized. Explicit application to existing matches can replace a manual category; it still respects the entire prioritized rule set.

## Cash flow and budgets

Exclude transfers. Positive ordinary transactions are income, negative ordinary transactions are expenses, and positive refunds subtract from expenses. Net = income − expenses. Savings rate = net / income × 100; return null if income is zero. Category expenses follow the same refund and transfer treatment.

Budget usage = category spent / limit × 100. Below 80% is OK; 80–99.99% is WARNING; 100% and above is EXCEEDED. A zero limit with positive spending is explicitly exceeded at a displayed 100%; zero spending against zero limit is 0%. Remaining amount may be negative. Recurring budgets start in their selected month. Overlapping budgets are rejected.

## Recurring payments

Group negative non-transfer/non-refund transactions by account, currency and normalized merchant. Require at least three occurrences. Use the median amount as the center; at least 75% of the group must lie within ±12% of the median. All retained intervals must fit weekly 6–8, monthly 25–35 or yearly 350–380 days; at most one doubled interval is accepted as a missing payment.

Confidence is the sum of:

| Evidence             | Weight | Calculation                                            |
| -------------------- | ------ | ------------------------------------------------------ |
| Merchant identity    | 25%    | Exact normalized group identity                        |
| Amount consistency   | 30%    | 1 − maximum relative deviation / 12%, clamped to [0,1] |
| Interval consistency | 30%    | Share of intervals inside the single-period window     |
| Occurrence evidence  | 15%    | min(occurrences / 6, 1)                                |

Require confidence ≥70%. This is a deterministic evidence score, not a probability. Status and candidate identity are preserved on redetection; a >12% mean-amount change is material and resets review. Rejected or inactive patterns are not resurfaced merely because an additional matching month arrived. Multiple different plans with one merchant are a known limitation.

Monthly costs use weekly ×52/12, monthly ×1 or yearly ÷12, rounded to minor units. Estimated yearly cost is monthly ×12. The next payment is projected using calendar-aware increments from the last observed date; stale payments require user review rather than an automatic cancellation assumption.

## Savings forecast

Use up to six complete calendar months ending before the current month. Start at the first available month; include missing later months as zero. Imported history may itself be incomplete, so the UI exposes the observed month count.

1. Average monthly income.
2. Identify historical transactions belonging to detected/confirmed recurring patterns.
3. Subtract these fixed expenses from observed expenses to obtain variable expenses.
4. Replace historical fixed expense averages with known current monthly recurring costs, avoiding double counting.
5. Estimate the variable-spending slope from first to last month, capped at ±20% of average variable expenses. Use zero trend with fewer than three months.
6. Monthly expected savings = average income − average variable expenses − current recurring cost − trend adjustment.
7. Cumulative expected savings = monthly savings × horizon.
8. Range margin = (historical net-cash-flow sample standard deviation + 10% of absolute expected monthly savings) × sqrt(horizon). A one-month history uses a 25% variability allowance instead of sample variance.

Bounds are scenarios, not calibrated confidence intervals. No initial balance, FX return, investment yield, future salary change or inflation forecast is invented. With no complete month, the UI asks for history instead of displaying a seemingly precise forecast.

## Insights

Named rules report category budget usage at ≥80%, savings-rate changes in percentage points against the prior month, and current total spending more than 20% above the prior observed six-month average. A current-month comparison explicitly states that the month may be incomplete. Each statement follows a concrete calculation; no AI-generated financial advice is used.
