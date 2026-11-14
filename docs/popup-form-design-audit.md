# Popup and form design audit

The audit covers platform admin, company owner, sales agent, and team lead views. Shared company forms retain the same API handlers and permission gates for each role.

## Shared design

- Modal and drawer headings, fields, errors, disabled controls, file inputs, native checkboxes/radios, keyboard focus, and action footers follow the existing admin design tokens.
- Long dialogs keep their heading and action footer visible while content scrolls. Drawers constrain their body to the viewport; invoice, subscription, support-ticket and company-edit submit buttons target their original form from a fixed footer.
- Mobile dialogs keep 16-pixel viewport margins, collapse field grids, wrap actions, and use dynamic viewport height. Wide drawer content and JSON panels scroll internally.
- The workspace-access popup now uses the same shared styles. Its Arabic direction is explicit because it sits outside the company shell.
- Activation and temporary-password forms use border-box sizing and mobile padding to prevent their cards overflowing narrow screens.

## Source coverage

`npm run check:overlays` parses external HTML and inline Angular templates. It checks all 72 dialog/drawer declarations for modal semantics and accessible names, checks 25 icon close buttons for names, and verifies detached footer submit actions reference their form. The staging workflow runs this check before building.

Admin overlays cover companies/owner invitations/workspace entry, onboarding, plans, subscriptions, invoices, payments, features, limits, integrations, tickets, announcements, platform users, roles, audit logs, settings and demo requests. Company overlays cover leads/duplicates, pipeline outcomes, contacts, calendar, tasks/details, inventory (projects/phases/buildings/units), holds/reservations, contracts/evidence, commissions, documents, campaigns, routing rules, team invitations/membership, My team assignments/status changes and workspace access.

## Runtime validation

The audit uses an isolated staging company and QA owner, sales and lead accounts. Creation dialogs are opened and dismissed without creating accounts, sending invitations, charging payments, or submitting customer changes. Desktop and 390-pixel mobile checks verify controls remain within the overlay, action reachability and English/Arabic layouts. Conditional/destructive/financial states are reviewed through their shared templates and existing automated tests; they are not all executed against live records.

The workspace-entry check exposed an existing API failure: workspace lifecycle events used the public company reference where the outbox requires a UUID. The backend fix preserves the public API response and covers enter, elevate, drop, expiry, exit and audit rollback with a PostgreSQL regression test.
