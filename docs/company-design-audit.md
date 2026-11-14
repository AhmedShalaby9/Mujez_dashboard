# Company workspace design alignment

Reference: the redesigned platform admin screens and their shared `admin-sidebar.scss`, `admin-ui.scss`, and `admin-table.scss` foundations.

## Changes

- Reuse the admin sidebar styling: navigation icons, grouped sections, active markers, company identity, desktop collapse, and mobile drawer. Permission filtering remains in `visibleNav`; icon-only links retain accessible names.
- Remove company-wide compact heading, table, and card overrides. Match segmented controls and status tabs to the admin screens.
- Separate overview/report/commission/marketing/routing KPI cards with the same spacing, borders, and typography.
- Keep lead owner and saved-view filters compact and label their inputs.
- Rename company content panels previously called `box`. That name collides with the admin checkbox's fixed 16-pixel dimensions and white text, clipping overview/report/task/lead-detail content.
- Give the open mobile drawer sufficient selector specificity in both directions.

## Route audit

All 17 company-owner routes were opened against staging APIs in an isolated QA company. English desktop (1280px), English mobile (390px), and Arabic desktop (1280px) checks found no document-level horizontal overflow. Wide boards and tables retain internal scrolling. Empty states were checked; this was not an exhaustive populated-data or mutation test.

| Page         | Main layout checked                                                |
| ------------ | ------------------------------------------------------------------ |
| Dashboard    | Independent KPIs, pipeline, today, leads, team, tasks, inventory   |
| Pipeline     | Board and filters                                                  |
| Leads        | Owner/search/stage filters, saved view toolbar, table              |
| Contacts     | Contact list and detail empty state                                |
| Calendar     | Calendar grid and agenda                                           |
| Tasks        | Filters, task list, summary panels                                 |
| Projects     | Project list and detail layout                                     |
| Units        | Type/status filters and inventory empty state                      |
| Reservations | Filters and reservation list                                       |
| Contracts    | Filters and contract list                                          |
| Commissions  | KPIs and list; Starter feature gate preserved, Pro QA check passed |
| Documents    | Filters and document list                                          |
| Marketing    | KPIs, campaign list, integration state                             |
| Reports      | Independent KPIs, charts, funnel, sources, performance             |
| Lead Routing | KPIs, rule and worker panels                                       |
| Audit Log    | Event filters and list                                             |
| Team         | Employee/team tabs, status filters, member list                    |

My team remains a Team Lead-only route. Its tab controls also use the shared design; existing team-work component tests remain passing. Owner navigation does not expose that route.

## Validation

- Production build passes (existing component stylesheet budget warnings remain).
- All 87 frontend tests pass, including new navigation permission/group/collapse and mobile expansion tests.
- No API contract, permission, financial record, or real-company data changes.
