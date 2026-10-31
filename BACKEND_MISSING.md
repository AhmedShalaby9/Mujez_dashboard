# Backend missing

Things the new Platform Admin design shows that the backend doesn't support yet.
The frontend renders each one statically. In the UI, these are marked with an amber **Not saved yet / Soon / Sample** tag or a dashed card, and the data is never sent.
When an item is implemented, remove its tag in the listed file and wire it to the new field or endpoint.

Checked against `mujez_backend` @ `af51c30` (`src/modules/platform/companies`, `src/modules/platform/subscriptions`, `src/modules/platform/billing`, `docs/*.md`).

---

## Companies (`/admin/companies`)

Already real: list, search/filters, status tabs, plan, type, city, users, MRR, cycle, slug, owner card, edit,
enter workspace, suspend/reactivate/archive, CSV export. The Subscription column, the **Past due** tab and the seat/usage
bars use real data from `GET /subscriptions` (needs `sub.manage`) and `GET /usage` (needs `usage`). Without
those permissions the cells show `—`.

| # | Design element | Today | Needed from backend |
|---|---|---|---|
| C1 | **Last active** column / drawer row | Shows `lastActivity`, which is `companies.updated_at` (last *record edit*). Relabelled **Last updated** to stay accurate. | A real last-tenant-activity timestamp (e.g. latest tenant session/login or audited tenant write) on the company DTO, e.g. `lastActiveAt`. |
| C2 | **Subscription** status per company in the list | Frontend fetches every page of `/subscriptions` and joins by `companyId`. Users without `sub.manage` see `—`. | Add `subscriptionStatus` (`trialing/active/past_due/canceled/expired/suspended`) to `companyDto` (the `company_subscription_summary` view already has the row). Also lets `co.view`-only admins see it. |
| C3 | **Users x / seats** bar | Uses `/usage` (needs `usage` permission). | Optional: add `seatLimit` to `companyDto` so `co.view` users get the bar without the usage permission. |
| C4 | Suspend/archive dialog **Reason category** (Non-payment / Security review / Terms violation / Customer request) and **acknowledgement** checkbox | API has one free-text `reason`. Frontend sends `"[Category] note"`. The acknowledgement is client-side only. | `StatusInput.reasonCode` enum (stored in `status_reason_code`, shown in the drawer note and audit log). Optional `acknowledged: true` in the audit payload. |
| C5 | Drawer **Leads** usage bar (design: Users / Leads / Storage) | Shows Users / Listings / Storage from `/usage`. Leads isn't shown. | A leads quota + measurement in `/usage` if leads should be capped per plan (docs say there's no lead quota today). |
| C6 | Workspace URL `slug.mujez.com` | Shows the slug only, since the tenant domain format isn't defined. | Expose the tenant workspace URL (or base domain) in `/platform-defaults` or the company DTO. |

## Onboarding (`/admin/onboarding`)

Already real: companies in onboarding (`?onboarding=true`), plan, slug, 5-step progress (manual checklist), next step,
stuck days, status, step toggles, activate. **Trials ending ≤ 7 days** and the **Trial ends** column use trialing
subscriptions' `renewsOn` (needs `sub.manage`). **Resend invite** opens the company drawer in Companies, where the
real resend/invite flow lives.

| # | Design element | Today | Needed from backend |
|---|---|---|---|
| O1 | **Median time to first deal** stat | Static sample value (`11 days`), dashed card + "Sample" tag. | Endpoint/aggregate: median days from company `created_at` to the first `first_deal` completion (or first closed deal), last 90 days. |
| O2 | **Trial → paid** conversion stat | Static sample value (`58%`, `18 of 31`). | Aggregate: trials started vs. converted to paid in the last 90 days. Note: docs say new companies start paid with no free trial, so define the metric first. |
| O3 | **Success manager** column | Static "Unassigned", "Soon" tag. | `successManagerId` on companies (a platform user), returned as `{ id, name }`, plus an endpoint to assign it. |
| O4 | **Send reminder** action (trial/active companies) | Shows a toast saying reminders aren't connected. Nothing is sent. | `POST /companies/:id/onboarding/reminder` with `{ step?, version }`, queued through the outbox/email worker and audited. |
| O5 | **Trial ends** for `co.view`-only admins | `—` without `sub.manage`. | Add `trialEndsAt` to the onboarding DTO. |

## Create company wizard (`/admin/onboarding/new`, new page)

Sent today (`POST /admin/api/v1/companies`): `nameEn, nameAr, slug, type, city, adminEmail, phone, website, plan`.
The backend always creates an **active** company with a **monthly** subscription on the plan and emails the owner.
Plan prices and default limits shown in the wizard come from `GET /plans` (falls back to `/plan-options`).

| # | Wizard field / feature | Step | Needed from backend |
|---|---|---|---|
| W1 | Country | Company | `country` (ISO-2) on companies; drives VAT/currency. |
| W2 | Business address | Company | `address` on companies. |
| W3 | Company email (separate from owner email) | Company | `companyEmail` on companies. Today `adminEmail` is both contact and owner login. |
| W4 | Tax registration no., Commercial registration no. | Company | `taxNumber`, `crNumber` on companies (needed for invoices). |
| W5 | Administrator full name, mobile, job title, preferred language | Administrator | Accept `owner: { name, phone, title, lang }` on create and pass it to `OwnerWelcomeService.provision` (welcome email language, owner display name). |
| W6 | Billing cycle **Annual** | Subscription | Accept `cycle: 'monthly' \| 'annual'` on create (`createInitialSubscription` is monthly only). |
| W7 | **Start as trial** (21 days) | Subscription | Accept `mode: 'trial' \| 'paid'` (company `trial` + `trialing` subscription), if trials come back. |
| W8 | Start date | Subscription | Accept `startDate` for the initial subscription period. |
| W9 | Payment method (card / bank / InstaPay / invoice net 14) | Subscription | Accept `paymentMethod` on the initial subscription (the subscription entity already has `payment`). |
| W10 | Discount (10/15/20%) | Subscription | Accept `discountPercent` and apply it to the first invoice / subscription amount. |
| W11 | Billing currency (EGP/USD/SAR) | Subscription | Multi-currency plan prices + `currency` on subscription. |
| W12 | First-invoice preview with VAT 14% | Subscription | Shown as a *Preview* computed client-side. Needs a `POST /companies/quote` (or plan pricing with tax rules) so the numbers come from the server. |
| W13 | Custom resource limits at creation (users, listings, projects, storage, unlimited toggles) | Limits | Accept `limits` overrides on create. Today only `/usage/:id/override` exists, and it's +20% for 30 days, not arbitrary values. |
| W14 | Per-company module on/off at creation | Features | Accept `featureOverrides: [{ key, enabled }]` on create (no expiry). Today `/feature-overrides` requires an expiry within a year and a reason, and the company must exist first. |
| W15 | **Save draft** | Footer | A draft state (`status: 'draft'`, no owner email, no subscription) + `POST /companies/drafts` / resume. Today the button shows a "not saved yet" toast. |

---

## Subscription plans (`/admin/subscription-plans`)

Already real: plan catalog, monthly/annual prices (toggle), description, users/listings/projects/storage limits,
feature chips (split from `featsEn/featsAr`), subscriber count, create, versioned edit with new/renewal/migrate scope
and subscriber selection, archive/restore, and Subscribers link. **Most popular** goes to the plan with the most current
subscribers. **Est. MRR** per plan sums `mrr` from `GET /subscriptions` (needs `sub.manage`, else `—`).

| # | Design element | Today | Needed from backend |
|---|---|---|---|
| P1 | **Leads** limit row on each card + edit field | Row shows `—` with a "Soon" tag. The edit field is disabled. | `leads` limit on plan versions (`PlanInput.leads`, nullable = unlimited) and its measurement in `/usage`. |
| P2 | **API requests / day** limit row + edit field | Same as P1. | `apiPerDay` limit on plan versions and enforcement at the API gateway. |
| P3 | **Est. MRR** per plan for users without `sub.manage` | `—`. | Add `mrrMinor` (sum of current active contract MRR) to each row of `GET /plans`. |
| P4 | Archive dialog **internal note** | Field shown with a "Not saved yet" tag and not sent. | Optional `reason` on `PlanArchive`, written to the audit log. |
| P5 | Structured feature list (design shows module chips derived from the plan tier) | Chips are split from free-text `featsEn/featsAr`. | Optional: return the plan's feature entitlements from `/features` keyed by plan, so chips match real module access. |
| P6 | Design note "Prices exclude 14% VAT" | Left out, because there's no tax configuration. | Tax settings (rate, inclusive/exclusive) in `/settings` or on the plan. |

## Subscriptions (`/admin/subscriptions`)

Already real: list, search, plan and payment-method filters, status tabs including **Cancels at renewal**
(`cancelAtPeriodEnd`), Platform MRR, Active / Trialing / Past due counts (with "renew within 7 days" and "trial ends this week"),
amount, cycle, started (`periodStart`), renews/ends, drawer, create subscription, **Change plan** (upgrade/downgrade
shortcuts preselect the next plan), **Renew**, and **Cancel** (at period end).

| # | Design element | Today | Needed from backend |
|---|---|---|---|
| S1 | **Churn** KPI | Static sample (`2.4%`, `3 cancellations`), dashed card + "Sample" tag. | Monthly churn aggregate (cancellations ÷ subscriptions active at month start), e.g. in `/overview`. |
| S2 | **Send renewal reminders** button | Opens a preview dialog. Confirm shows "not connected" and nothing is sent. | `POST /subscriptions/reminders` (`withinDays`) queued through the outbox/email worker. Docs: no renewal/dunning worker yet. |
| S3 | **Change billing cycle…** (row menu) | Preview dialog only. The change-plan dialog keeps the cycle unchanged. | Accept `cycle` on `POST /subscriptions/:id/change` (or a new `/cycle` action), applied at renewal. |
| S4 | Change plan **"At renewal"** timing | Disabled option with a "Soon" tag. Only "Immediately" works. | `when: 'now' \| 'renewal'` on change. Renewal = store a pending plan version (like the plan-edit renewal scope). |
| S5 | Change plan **proration preview** | Shows current vs new price and says no proration is processed. | If proration is wanted, `POST /subscriptions/:id/change/preview` returning the prorated amount. |
| S6 | **Extend trial…** | Preview dialog only (7/14/21 days + note). | `POST /subscriptions/:id/extend-trial` with `days`, `reason`, `version`. Note: new trials aren't offered, so this applies only to historic trialing records. |
| S7 | **Manual adjustment…** (credit/charge) | Preview dialog only. | `POST /subscriptions/:id/adjustments` with `type: credit\|charge`, `amountMinor`, `reason`, linked to billing/invoices. |
| S8 | Cancel **reason** + **internal note** | Shown with "Not saved yet" tags and not sent. The cancel API takes only `version`. | `reason` enum (`price/features/competitor/closed/other`) + `note` on `POST /subscriptions/:id/cancel`, stored and audited (also feeds S1). |
| S9 | Cancel **Immediately** option | Disabled with a "Soon" tag. Cancellation is always at period end. | `when: 'now'` on cancel (ends access immediately, optional refund flag). |
| S10 | **Payment** column as payment *status* (Paid / Failed / Pending) | Shows the recorded payment *method* (card/bank/InstaPay). | `paymentStatus` from the latest invoice/payment per subscription. Depends on billing/payments being real. |
| S11 | **Past due** handling note (grace period, auto-suspend) | The drawer says there's no automatic retry or suspension yet. | Dunning: grace period setting, retries, automatic suspension job. |
| S12 | Drawer **HISTORY** timeline | Shows the current period start only + a pointer to Audit logs, "Soon" tag. | `GET /subscriptions/:id/history` (created, plan changes, renewals, cancellation) from audit/outbox events. |

## Billing & invoices (`/admin/billing`)

Already real: invoice list (`GET /invoices`), status tabs (draft/open/partial/overdue/paid/void), search, KPIs (billed and
collected this month, outstanding, overdue count + amount — computed from invoices), drawer with subtotal/tax/total/paid/
credited/balance lines, credit notes, linked payments (from `GET /payments`), new draft invoice, **Finalize**
(`/issue`), **Record manual payment**, **Issue credit note** and **Void** (password-confirmed), CSV export (client-side).
Header terms come from `/platform-defaults` (`paymentTerms`, `taxRate`). `/admin/billing?invoice=INV-…` opens an invoice.

| # | Design element | Today | Needed from backend |
|---|---|---|---|
| B1 | **Download PDF** | Menu/drawer item with "Soon" tag. Shows a "not available" toast. | `GET /invoices/:number/pdf` (rendered invoice with company tax details). |
| B2 | **Send invoice** (email to billing contact) | "Soon" tag, toast only. | `POST /invoices/:number/send`, queued through outbox/email, audited (and record `sentAt`). |
| B3 | **Failed payments** KPI | Dashed static card (`—`). | Gateway payment attempts with a `failed` state (see Y1). |
| B4 | **Automatic overdue reminders** (design note: "reminders sent on day 1 and 3") | The drawer says no automatic reminders are sent. | Dunning schedule + reminder log per invoice. |
| B5 | **Tax treatment / ETA e-invoice** | Shows the entered tax rate + "e-invoice: soon" tag. | Egyptian Tax Authority e-invoice submission (UUID, status) and per-company tax profile. |
| B6 | **Bill-to email** in the drawer | Shows the company name only. | Include the billing contact email (`companyEmail` / `adminEmail`) in the invoice DTO snapshot. |
| B7 | Server-side search/filter/totals | All pages are fetched and filtered client-side (`limit` max 100/page). | `GET /invoices?status=&q=&from=&to=` plus a `summary` block (billed/collected/outstanding/overdue) for large datasets. |
| B8 | Invoice numbering format shown in header (`INV-{YYYY}-{####}`) | Replaced with real payment terms/tax from settings. | Expose the numbering pattern in `/platform-defaults` if it should be shown. |

## Payments (`/admin/payments`)

Already real: payment list, search, method filter, tabs (completed / **pending reconciliation** / refunded / partially refunded),
KPIs (collected last 30 days net of refunds, pending + unmatched reconciliation, refunded this year), drawer with
amount/refunded/net, refund history, **Mark as reconciled / unmatched** (`/reconcile`), **Refund** (password-confirmed),
**Open invoice** (deep link into Billing).

| # | Design element | Today | Needed from backend |
|---|---|---|---|
| Y1 | **Failed** tab + KPI, **Retry charge** action, decline reason ("insufficient funds…") | No Failed tab. Dashed static KPI card. Retry shows a "needs gateway" toast. | Payment-gateway integration that records attempts (`pending/failed/succeeded`), decline codes, and `POST /payments/:id/retry`. Payments today are manual records only. |
| Y2 | **Success rate** KPI | Dashed static card (`—`). | Derived from Y1 attempts (succeeded ÷ attempted, excluding pending). |
| Y3 | **Reconcile bank file** button | "Soon" tag, toast only. | `POST /payments/reconciliation/import` (CSV/MT940 upload) that auto-matches by reference and amount and returns matched/unmatched lists. |
| Y4 | Card **•••• last 4** in the drawer | Not shown. | Store a masked card suffix/brand from the gateway (never the full PAN). |
| Y5 | "Customer was emailed a payment link" (failed note) | Not shown. | Payment-link generation + email (depends on Y1/B2). |
| Y6 | Server-side search/filter/totals | Client-side over all pages. | `GET /payments?status=&reconciliation=&method=&q=&from=&to=` + summary block. |

---

## Dashboard (from the earlier redesign, `/admin/dashboard`)

Already left out of the UI rather than faked. Listed so the full design can be restored later.

| # | Design element | Needed from backend |
|---|---|---|
| D1 | MRR growth badge (e.g. `+3.3%`) and **MRR growth** bar chart | Historical MRR series (`capabilities.historicalMrr` is `false`). |
| D2 | **Monthly churn** stat | Churn calculation (`capabilities.churn` is `false`). |
| D3 | **Trial → paid** stat | Same as O2. |
| D4 | **Upcoming renewals** list | `GET /subscriptions?renewingWithin=14d` or include in `/overview`. |
| D5 | Revenue movement chips (New / Expansion / Churned / Net) | MRR movement breakdown per range. |
| D6 | Recent companies: plan, status, last active columns | Add `plan`, `status`, `lastActiveAt` to `overview.growth[]`. |
