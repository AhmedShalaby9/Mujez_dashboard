# Backend missing

Things the new Platform Admin design shows that the backend doesn't support yet.
The frontend renders each one statically. In the UI, these are marked with an amber **Not saved yet / Soon / Sample** tag or a dashed card, and the data is never sent.
When an item is implemented, remove its tag in the listed file and wire it to the new field or endpoint.

Checked against `mujez_backend` @ `af51c30` (`src/modules/platform/companies`, `docs/*.md`).

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
